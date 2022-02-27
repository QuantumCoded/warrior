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
    if (req.method === 'POST') {
        let html = '';

        req.on('data', chunk => {
            html += chunk;

            if (html.length > 1e7) {
                req.socket.destroy();
            }
        });

        req.on('end', () => {
            const dom = new JSDOM(html);

            const words: NodeListOf<HTMLSpanElement> = dom.window.document.querySelectorAll('.SetPageTerm-wordText > .TermText');
            const definitions: NodeListOf<HTMLSpanElement> = dom.window.document.querySelectorAll('.SetPageTerm-definitionText > .TermText');
            const terms = Array.from(words).map((word, i) => ({ word: word.textContent, definition: definitions[i].textContent }));

            res.writeHead(200, 'OK', { 'content-type': 'text/json' }).end(JSON.stringify(terms));
        });

        return;
    }

    if (req.url == undefined) {
        res.writeHead(400, 'Bad Request').end();
        return;
    }

    const search = url.parse(req.url, true).query.search;

    if (typeof search !== 'string') {
        res.writeHead(400, 'Bad Request').end("400 Bad Request");
        return;
    }

    google_search(search, (error, result) => {
        if (error) {
            res.writeHead(500, 'Internal Server Error').end(JSON.stringify(error));
        } else {
            res.writeHead(200, 'OK', { 'content-type': 'text/json' }).end(JSON.stringify(result?.data?.items));
        }
    });
}).listen(process.env.PORT || 8080, () => { console.log("ready") });