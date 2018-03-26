"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const slack = require("@slack/client");
const BigQuery = require('@google-cloud/bigquery');
// import Octokat from 'octokat';
const util = require("util");
const moment = require("moment");
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
function updateLicensePlist() {
    return __awaiter(this, void 0, void 0, function* () {
        const Octokat = require('octokat');
        const octo = Octokat();
        const owner = 'mono0926';
        const repo = 'LicensePlist';
        const lp = yield octo.repos(owner, repo).fetch();
        const stargazersCount = lp.stargazersCount;
        console.log(lp.stargazersCount);
        const bigquery = new BigQuery({ projectId: 'mono-firebase' });
        const results = yield bigquery.query({
            query: `SELECT
    max(stargazers) as stargazers
  FROM
    \`noon.githubStargazers\`
  WHERE
    date = '${moment().add(-1, 'days').format('YYYY-MM-DD')}'
  GROUP by date`,
            useLegacySql: false
        });
        const rows = results[0];
        const prev = rows[0].stargazers;
        console.log(prev);
        try {
            yield bigquery
                .dataset('noon')
                .table('githubStargazers')
                .insert([{
                    date: moment().format('YYYY-MM-DD'),
                    owner: owner,
                    repo: repo,
                    stargazers: stargazersCount
                }]);
        }
        catch (error) {
            console.error(util.inspect(error, true, 4));
        }
        const diff = stargazersCount - prev;
        let diffStr = '-';
        if (diff > 0) {
            diffStr = `${diff}⤴️`;
        }
        else if (diff < 0) {
            diffStr = `${diff}⤵️`;
        }
        const client = new slack.WebClient(functions.config().slack.token);
        yield client.chat.postMessage({
            text: '時報(　´･‿･｀)',
            channel: '#-guest-pancake',
            attachments: [{
                    color: 'good',
                    title: 'LicensePlist️',
                    fields: [
                        {
                            title: '⭐️',
                            value: stargazersCount,
                            short: true
                        },
                        {
                            title: '差分',
                            value: diffStr,
                            short: true
                        }
                    ]
                },
                {
                    title: 'レポート',
                    text: 'https://datastudio.google.com/open/1gftzwQ1plk6ssie12k9cvLRaxRRAxkDr'
                }]
        });
    });
}
exports.updateLicensePlist = updateLicensePlist;
exports.onPublishedNoon = functions.pubsub.topic('noon').onPublish((event) => __awaiter(this, void 0, void 0, function* () {
    yield updateLicensePlist();
}));
//# sourceMappingURL=index.js.map