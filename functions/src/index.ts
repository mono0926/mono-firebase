import * as logger from 'firebase-functions/logger'
import { HttpsError, onRequest } from 'firebase-functions/v2/https'
import fetch from 'node-fetch'

// 秘密の文字列（環境変数から取得するのがベスト）
const SECRET_STRING = 'mySecretKey'

// Google Maps短縮URLからリダイレクト先を取得する関数
async function getRedirectUrl(shortUrl: string): Promise<string> {
  const response = await fetch(shortUrl, {
    method: 'HEAD',
    redirect: 'manual',
  })

  const redirectUrl = response.headers.get('location')
  if (!redirectUrl) {
    throw new HttpsError('not-found', 'Failed to get redirect URL')
  }
  return redirectUrl
}

// Google Maps URLから情報を抽出する関数
function extractGoogleMapInfo(redirectUrl: string): {
  place: string
  ftid: string
} {
  const urlParams = new URLSearchParams(redirectUrl.split('?')[1])
  const query = urlParams.get('q')
  const ftid = urlParams.get('ftid')

  if (!query || !ftid) {
    throw new HttpsError(
      'invalid-argument',
      'Invalid Google Maps redirect URL: missing q or ftid'
    )
  }

  // qパラメーターから場所名を抽出
  const decodedQuery = decodeURIComponent(query)
  const parts = decodedQuery.split(' ')

  // 住所やフロア情報をスキップして、場所名を取得
  let placeStartIndex = 0
  for (let i = 0; i < parts.length; i++) {
    if (/〒|都|府|県|市|区|町|村|丁目|番地|^\d+[F]$/.test(parts[i])) {
      placeStartIndex = i + 1 // 住所やフロアの次の部分から場所名開始
    }
  }

  // 住所以降の部分を結合して場所名とする
  const place = parts.slice(placeStartIndex).join(' ').trim()

  return { place, ftid }
}

// Apple Maps URLから情報を抽出する関数
function extractAppleMapInfo(url: string): {
  place: string
  coordinate: string
} {
  const urlParams = new URLSearchParams(url.split('?')[1])
  const place = urlParams.get('name')
  const coordinate = urlParams.get('coordinate')

  if (!place || !coordinate) {
    throw new HttpsError('invalid-argument', 'Invalid Apple Maps URL')
  }

  return { place, coordinate }
}

export const convertMap = onRequest(async (req, res) => {
  try {
    // ヘッダーチェック
    const secretHeader = req.get('X-Secret-String')
    if (!secretHeader || secretHeader !== SECRET_STRING) {
      throw new HttpsError(
        'permission-denied',
        'Forbidden: Invalid or missing secret string'
      )
    }

    const { url } = req.body
    if (!url || typeof url !== 'string') {
      throw new HttpsError('invalid-argument', 'URL is required')
    }

    // Google Maps URL処理
    if (url.includes('maps.app.goo.gl')) {
      const redirectUrl = await getRedirectUrl(url)
      const { place, ftid } = extractGoogleMapInfo(redirectUrl)
      const appleMapUrl = `http://maps.apple.com/?q=${encodeURIComponent(place)}`

      res.status(200).json({
        place,
        appleMapUrl,
        ftid,
      })
      return
    }

    // Apple Maps URL処理
    if (url.includes('maps.apple.com')) {
      const { place, coordinate } = extractAppleMapInfo(url)
      const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

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
})
