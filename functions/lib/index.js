"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPublishedNoon = exports.notifyAirWait = exports.notifyAirWaitLoop = void 0;
const functions = require("firebase-functions");
const slack = require("@slack/client");
const axios_1 = require("axios");
const logger = require("firebase-functions/logger");
function notifyAirWaitLoop() {
    return __awaiter(this, void 0, void 0, function* () {
        // 10秒おきにnotifyAirWaitを実行して、trueが返ってきたら終了する
        const intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            const done = yield notifyAirWait();
            console.log(`done: ${done}`);
            if (done) {
                clearInterval(intervalId);
            }
        }), 10000);
    });
}
exports.notifyAirWaitLoop = notifyAirWaitLoop;
function notifyAirWait() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield axios_1.default.post('https://airwait.jp/WCSP/api/internal/stateless/reserve/get', {
            storeId: 'KR00290960',
            reserveId: '000161004494',
            p: 'bd45f1de0044aefe78b9b0106e5256ce515241f3a5d7055dcba700e2867c93a8',
        }, {
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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
                Referer: 'https://airwait.jp/WCSP/waitDetail?storeNo=AKR9144283865&reserveId=000154306830&p=fb5c2ac111e1df19044f43a66946d6a4515241f3a5d7055dcba700e2867c93a8',
                'Content-Length': '122',
                Connection: 'keep-alive',
                'Sec-Fetch-Dest': 'empty',
                Cookie: 'TRC=d62fe682-071d-4319-83a8-907f44478a66; AWT_CSP_SID=f6fea8e4-cfb8-4c13-a4bf-763ac3c5d4c3; r_ad_token1=5413Su00QA15t001msoX; r_ad_token2=5413Su00QA15t001msoX; s_cc=true; s_cm=1; s_fid=3BAE7C5A35C50692-092D38664AC8F671; s_sq=%5B%5BB%5D%5D; s_store_id=KR00290960',
                Corwcspkeycd: 'AJAX-60FEC286-7B29-454D-A21B-A33AF22DD05B',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Csrf-Token': '3f6e4470-7a41-46bc-865b-f6a5618d304f',
            },
        });
        const count = res.data.innerDto.waitCount;
        logger.log(`count: ${count}`);
        if (count > 1) {
            return false;
        }
        const client = new slack.WebClient(functions.config().slack.token);
        yield client.chat.postMessage({
            text: '<@mono> 順番だよ(　´･‿･｀)',
            channel: '#mono-log',
            attachments: [
                {
                    color: 'good',
                    title: '現在の待ち人数',
                    text: `${count}`,
                },
            ],
        });
        return true;
    });
}
exports.notifyAirWait = notifyAirWait;
exports.onPublishedNoon = functions.pubsub
    .topic('noon')
    .onPublish((event) => __awaiter(void 0, void 0, void 0, function* () {
    yield notifyAirWait();
}));
//# sourceMappingURL=index.js.map