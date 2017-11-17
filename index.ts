
import * as cluster from 'cluster'
import * as elasticsearch from 'elasticsearch'
import * as Koa from 'koa'
import * as bodyParser from 'koa-bodyparser'
import * as Router from 'koa-router'
import { cpus } from 'os'
import {
    Config
} from './interfaces'
import { logger } from './logger'

const ELASTIC_URL = process.env.ELASTIC_URL || 'localhost:9200'
const PORT = process.env.PORT || 6763

const client = new elasticsearch.Client({
    host: ELASTIC_URL,
    log: 'trace',
    requestTimeout: 99999999
})

const app = new Koa()
const router = new Router()

router.post('/upload', async (ctx: any , next: () => Promise<any>) => {
    const {
        entities,
        indexName,
        async,
        settings,
        autoremove,
    } = ctx.request.body as Config

    if (!entities) {
        ctx.throw(422, `entities payload is missing`)
    }

    if (!indexName) {
        ctx.throw(422, `index name is missing`)
    }

    try {
        const indexExists = await client.indices.exists({
            index: indexName
        })

        if (indexExists && autoremove) {
            await client.indices.delete({
                index: indexName
            })
        }

        if (!indexExists) {
            await client.indices.create({
                index: indexName,
                body: settings
            })
        }

        /**
         * upload can be sync due to the limit on rps at Amazon Elastic
         * this mode is default
         */
        if (!async) {
            for (const entity of entities) {
                await client.create({
                    index: indexName,
                    type: 'feature',
                    /**
                     * if required custom
                     */
                    // id: '',
                    body: entity
                })
            }
        }

        if (async) {
            Promise.all(entities.map((entity) => client.create({
                index: indexName,
                type: 'feature',
                /**
                 * if required custom
                 */
                // id: '',
                body: entity
            })))
        }

        ctx.body = { result: 'success' }
    } catch (e) {
        logger.error('error', e)
        ctx.throw(404, e)
    }
})

app
    .use(bodyParser())
    .use(router.routes())
    .listen(PORT, () => {
        logger.log('info', `ELASTIC_UPLOADER_SERVICE: listening on port ${PORT} `)
    })
