import * as logger from 'firebase-functions/logger'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onRequest } from 'firebase-functions/v2/https'

const secretKey = defineSecret('convertMapSecretKey')
const googleMapsApiKey = defineSecret('convertMapGoogleMapsApiKey')

async function getFtidFromShortUrl(shortUrl: string): Promise<string> {
  const response = await fetch(shortUrl, {
    method: 'GET',
    redirect: 'manual',
  })

  const redirectUrl = response.headers.get('location')
  if (!redirectUrl) {
    throw new HttpsError('not-found', 'Failed to get redirect URL')
  }
  logger.info('Redirect URL:', redirectUrl)

  const urlParams = new URLSearchParams(redirectUrl.split('?')[1])
  const ftid = urlParams.get('ftid')
  if (!ftid) {
    throw new HttpsError('invalid-argument', 'No ftid found in redirect URL')
  }
  return ftid
}

async function getPlaceInfoFromFtid(
  ftid: string,
): Promise<{ place: string; coordinate: string; invalidPlace: boolean }> {
  const apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?ftid=${ftid}&fields=name,geometry,plus_code&language=ja&key=${googleMapsApiKey.value()}`
  const response = await fetch(apiUrl)
  const data = (await response.json()) as any

  if (data.status !== 'OK') {
    throw new HttpsError(
      'not-found',
      `Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`,
    )
  }

  const place = data.result.name
  const plusCode = data.result.plus_code
  const location = data.result.geometry.location
  const coordinate = `${location.lat},${location.lng}`

  return { place, coordinate, invalidPlace: !plusCode }
}

async function fetchGooglePlaceId(
  coordinate: string,
  keyword: string,
): Promise<string | null> {
  const radius = 1000 // 検索半径（メートル）
  const apiUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinate}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&language=ja&key=${googleMapsApiKey.value()}`

  const response = await fetch(apiUrl)
  const data = (await response.json()) as any

  if (data.status !== 'OK') {
    logger.warn(
      `Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`,
    )
    return null
  }

  const placeId = data.results[0].place_id
  logger.info('Found place:', { name: data.results[0].name, placeId })

  return placeId
}

function extractAppleMapInfo(url: string): {
  place: string
  coordinate: string
  invalidPlace: boolean
} {
  const urlParams = new URLSearchParams(url.split('?')[1])
  const place = urlParams.get('name')
  const coordinate = urlParams.get('coordinate')

  if (!place || !coordinate) {
    throw new HttpsError('invalid-argument', 'Invalid Apple Maps URL')
  }

  return { place, coordinate, invalidPlace: place == 'Marked Location' }
}

export const convertMap = onRequest(
  { secrets: [googleMapsApiKey, secretKey], region: 'asia-northeast1' },
  async (req, res) => {
    try {
      const secretHeader = req.get('X-Secret-String')
      if (!secretHeader || secretHeader !== secretKey.value()) {
        throw new HttpsError(
          'permission-denied',
          'Forbidden: Invalid or missing secret string',
        )
      }

      const { url } = req.body
      if (!url || typeof url !== 'string') {
        throw new HttpsError('invalid-argument', 'URL is required')
      }

      if (url.includes('maps.app.goo.gl')) {
        const ftid = await getFtidFromShortUrl(url)
        const { place, coordinate, invalidPlace } =
          await getPlaceInfoFromFtid(ftid)
        const baseUrl = 'https://maps.apple.com/search'
        const appleMapUrl = invalidPlace
          ? `${baseUrl}?coordinate=${coordinate}`
          : `${baseUrl}?query=${encodeURIComponent(place)}&center=${coordinate}&span=0.0001,0.0001`

        res.status(200).json({
          place,
          appleMapUrl,
          coordinate,
        })
        return
      }

      if (url.includes('maps.apple.com')) {
        const { place, coordinate, invalidPlace } = extractAppleMapInfo(url)
        const googleMapUrl = await (async () => {
          const commonUrl = 'https://www.google.com/maps/search/?api=1&query='
          const coordinateUrl = `¥${commonUrl}${coordinate}`
          if (invalidPlace) {
            return coordinateUrl
          }
          const placeId = await fetchGooglePlaceId(coordinate, place)
          return placeId
            ? `${commonUrl}${encodeURIComponent(place)}&query_place_id=${placeId}`
            : coordinateUrl
        })()

        res.status(200).json({
          place,
          googleMapUrl,
          coordinate,
        })
        return
      }

      throw new HttpsError('invalid-argument', 'Unsupported URL format')
    } catch (error) {
      if (error instanceof HttpsError) {
        res.status(error.httpErrorCode.status).json({
          error: {
            code: error.code,
            message: error.message,
          },
        })
      } else {
        logger.error('Unexpected error:', error)
        res.status(500).json({
          error: {
            code: 'internal',
            message: 'Internal server error',
          },
        })
      }
    }
  },
)
