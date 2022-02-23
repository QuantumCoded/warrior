import { google } from 'googleapis';
import { createServer } from 'http';
import { JSDOM } from 'jsdom';
import * as superagent from 'superagent';
import * as url from 'url'
import { createReadStream } from 'fs';

const search = google.customsearch('v1');

/** Preforms a search using google's custom search API */
function google_search(query: string, callback: (error: any, result: any) => void) {
    search.cse.list({
        q: query,
        cx: process.env.CUSTOM_SEARCH_ENGINE_ID,
        key: process.env.CUSTOM_SEARCH_API_KEY,
    }, callback);
}

createServer(async (req, res) => {
    const results: any[] = [];

    if (req.url == undefined) {
        res.writeHead(400, 'Bad Request').end();
        return;
    }

    if (req.url == '/index.html' || req.url == '/') {
        createReadStream('index.html').pipe(res.writeHead(200, 'OK'));
        return;
    }

    const search = url.parse(req.url, true).query.search;

    if (typeof search !== 'string') {
        res.writeHead(400, 'Bad Request').end("400 Bad Request");
        return;
    }

    google_search(search, async (error, result) => {
        if (error) {
            if (!res.writableEnded) res.writeHead(500, 'Internal Server Error').end(JSON.stringify(error));
        } else {
            const items: { title: string, link: string }[] = result?.data?.items;

            await Promise.allSettled(items.map(async item => {
                const { title, link } = item;

                const html = await new Promise<string>((resolve, reject) => {
                    superagent
                        .get(link)
                        .set('Accept-Language', 'en-US,en;q=0.9,*;q=0.5')
                        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36')
                        .end((err, res) => {
                            if (err) {
                                console.log(err)
                                reject(err)
                            } else {
                                resolve(res.text)
                            }
                        });
                });

                const dom = new JSDOM(html);

                if (dom) {
                    const words: NodeListOf<HTMLSpanElement> = dom.window.document.querySelectorAll('.SetPageTerm-wordText > .TermText');
                    const definitions: NodeListOf<HTMLSpanElement> = dom.window.document.querySelectorAll('.SetPageTerm-definitionText > .TermText');

                    const map = Array.from(words).map((word, i) => ({ word: word.textContent, definition: definitions[i].textContent }));
                    results.push({ title, link, terms: map });
                }
            }));

            if (!res.writableEnded) res.writeHead(200, 'OK', { 'content-type': 'text/json' }).end(JSON.stringify(results));
        }
    });
}).listen(process.env.PORT || 8080, () => { console.log("ready") });