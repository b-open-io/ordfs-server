import * as express from 'express';
import { Response } from 'express';
import { NotFound } from 'http-errors';
import { File, OrdFS, getLatestBlock, getRawTx, loadInscription, loadPointerFromDNS } from './lib';

function sendFile(file: File, res: Response) {
    res.header('Content-Type', file.type || '');
    res.header('Cache-Control', 'public,immutable,max-age=31536000')
    res.status(200).send(file.data);
}

export function RegisterRoutes(app: express.Express) {
    app.get("/", async (req, res, next) => {
        try {
            const outpoint = await loadPointerFromDNS(req.hostname);
            let file = await loadInscription(outpoint)
            if (file.type === 'ord-fs/json' && !req.query['raw']) {
                req.res?.redirect('index.html');
                return
            }
            sendFile(file, res);
        } catch (err) {
            next(err);
        }
    });

    app.get("/v1/:network/block/latest", async (req, res, next) => {
        res.json(await getLatestBlock(req.params.network));
    });
    
    app.get("/v1/:network/tx/:txid", async (req, res, next) => {
        res.set('Content-type', 'application/octet-stream')
        res.send(await getRawTx(req.params.network, req.params.txid));
    });

    app.get("/:filename", loadFileOrOrdfs);
    app.get("/content/:filename", loadFileOrOrdfs);

    async function loadFileOrOrdfs(req, res, next) {
        const filename = req.params.filename;
        try {
            let pointer: string;
            let file: File;
            try {
                file = await loadInscription(filename)
                if (file.type === 'ord-fs/json' && !req.params.raw) {
                    req.res?.redirect(`/${filename}/index.html`);
                    return
                }
            } catch (e: any) {
                console.error('Outpoint Error', filename, e);
                pointer = await loadPointerFromDNS(req.hostname);
                const dirData = await loadInscription(pointer);
                const dir = JSON.parse(dirData.data!.toString('utf8'));
                if (!dir[filename]) {
                    throw new NotFound()
                }
                pointer = dir[filename].slice(6);
                file = await loadInscription(pointer)
            }
            sendFile(file, res);
        } catch (err) {
            next(err);
        }
    }

    app.get("/:pointer/:filename", loadFile);
    app.get("/content/:pointer/:filename", loadFile);

    async function loadFile(req, res, next) {
        try {
            let pointer = req.params.pointer;
            const filename = req.params.filename;
            const dirData = await loadInscription(pointer);
            const dir: OrdFS = JSON.parse(dirData.data!.toString('utf8'));
            if (!dir[filename]) {
                throw new NotFound()
            }
            if (dir[filename].startsWith('ord://')) {
                pointer = dir[filename].slice(6)
            } else {
                pointer = dir[filename];
            }
            const file = await loadInscription(pointer)
            sendFile(file, res);
        } catch (err) {
            next(err);
        }
    }
}