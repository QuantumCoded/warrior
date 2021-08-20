import { google } from 'googleapis';
import { createServer } from 'http';
import { JSDOM } from 'jsdom';
import * as url from 'url'

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

    const search = url.parse(req.url, true).query.search;

    if (typeof search !== 'string') {
        res.writeHead(400, 'Bad Request').end();
        return;
    }

    google_search(search, async (error, result) => {
        if (error) {
            res.writeHead(500, 'Internal Server Error').end(JSON.stringify(error));
        } else {
            const items: { title: string, link: string }[] = result?.data?.items;

            await Promise.allSettled(items.map(async item => {
                const { title, link } = item;

                const dom = await JSDOM.fromURL(link).catch(error => {
                    console.log(JSON.stringify(error, null, 4));
                    res.writeHead(500, 'Internal Server Error').end(JSON.stringify(error));
                });

                if (dom) {
                    const words: NodeListOf<HTMLSpanElement> = dom.window.document.querySelectorAll('.SetPageTerm-wordText > .TermText');
                    const definitions: NodeListOf<HTMLSpanElement> = dom.window.document.querySelectorAll('.SetPageTerm-definitionText > .TermText');

                    const map = Array.from(words).map((word, i) => ({ word: word.textContent, definition: definitions[i].textContent }));

                    console.log(link, map);

                    results.push({ title, link, terms: map });
                }
            }));

            res.writeHead(200, 'OK', { 'content-type': 'text/json' }).end(JSON.stringify(results));
        }
    });
}).listen(process.env.PORT || 8080);