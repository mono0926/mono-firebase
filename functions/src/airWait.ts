import * as slack from '@slack/client'
import axios from 'axios'
import * as functions from 'firebase-functions'
import * as logger from 'firebase-functions/logger'
import moment = require('moment')

// eslint-disable-next-line require-await
export async function notifyAirWaitLoop() {
  // 10秒おきにnotifyAirWaitを実行して、trueが返ってきたら終了する
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const intervalId = setInterval(async () => {
    const done = await notifyAirWait()
    console.log(`done: ${done}`)
    if (done) {
      clearInterval(intervalId)
    }
  }, 10000)
}
export async function notifyAirWait(): Promise<boolean> {
  const res = await axios.post(
    'https://airwait.jp/WCSP/api/internal/stateless/reserve/get',
    {
      storeId: 'KR00290960',
      reserveId: '000186485914',
      p: '544b6b5e06253719e6e1ad202907b9a4515241f3a5d7055dcba700e2867c93a8',
    },
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Sec-Fetch-Site': 'same-origin',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Mode': 'cors',
        Host: 'airwait.jp',
        Origin: 'https://airwait.jp',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
        Referer:
          'https://airwait.jp/WCSP/waitDetail?storeNo=AKR9144283865&reserveId=000154306830&p=fb5c2ac111e1df19044f43a66946d6a4515241f3a5d7055dcba700e2867c93a8',
        'Content-Length': '122',
        Connection: 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        Cookie:
          'TRC=d62fe682-071d-4319-83a8-907f44478a66; AWT_CSP_SID=f6fea8e4-cfb8-4c13-a4bf-763ac3c5d4c3; r_ad_token1=5413Su00QA15t001msoX; r_ad_token2=5413Su00QA15t001msoX; s_cc=true; s_cm=1; s_fid=3BAE7C5A35C50692-092D38664AC8F671; s_sq=%5B%5BB%5D%5D; s_store_id=KR00290960',
        Corwcspkeycd: 'AJAX-60FEC286-7B29-454D-A21B-A33AF22DD05B',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Csrf-Token': '3f6e4470-7a41-46bc-865b-f6a5618d304f',
      },
    },
  )
  const count = res.data.innerDto.waitCount
  logger.log(`count: ${count}`)
  if (count > 1) {
    return false
  }
  const client = new slack.WebClient(functions.config().slack.token)
  await client.chat.postMessage({
    text: '<@mono> 順番だよ(　´･‿･｀)',
    channel: '#mono-log',
    attachments: [
      {
        color: 'good',
        title: '現在の待ち人数',
        text: `${count}`,
      },
    ],
  })
  return true
}

// export const onPublishedNoon = functions.pubsub
//   .topic('noon')
//   .onPublish(async (event) => {
//     await notifyAirWait()
//   })
