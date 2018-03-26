import * as functions from 'firebase-functions';
import * as slack from '@slack/client';
const BigQuery = require('@google-cloud/bigquery');
// import Octokat from 'octokat';
import * as util from 'util';
import * as moment from 'moment';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

export async function updateLicensePlist() {
  const Octokat = require('octokat')
  const octo = Octokat();
  const owner = 'mono0926';
  const repo = 'LicensePlist';
  const lp = await octo.repos(owner, repo).fetch();
  const stargazersCount = lp.stargazersCount;
  console.log(lp.stargazersCount);

  const bigquery = new BigQuery({ projectId: 'mono-firebase' });
  const results = await bigquery.query({
    query: `SELECT
    max(stargazers) as stargazers
  FROM
    \`noon.githubStargazers\`
  WHERE
    date = '${moment().add(-1, 'days').format('YYYY-MM-DD')}'
  GROUP by date`,
    useLegacySql: false
  }) as any[];
  const rows = results[0];
  const prev = rows[0].stargazers;
  console.log(prev);

  try {
    await bigquery
    .dataset('noon')
    .table('githubStargazers')
    .insert([{
       date: moment().format('YYYY-MM-DD'), 
       owner: owner, 
       repo: repo, 
       stargazers: stargazersCount }])
  } catch (error) {
    console.error(util.inspect(error, true, 4));
  }
  const diff = stargazersCount - prev;
  let diffStr: string = '-';
  if (diff > 0) {
    diffStr = `${diff}⤴️`;
  } else if (diff < 0) {
    diffStr = `${diff}⤵️`;
  }
  const client = new slack.WebClient(functions.config().slack.token);
  await client.chat.postMessage({ 
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
  }] });
}

export const onPublishedNoon = functions.pubsub.topic('noon').onPublish(async event => {
  await updateLicensePlist();
});