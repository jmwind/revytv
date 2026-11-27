import { createRouter, type RouterContext } from 'remix/router'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import apiController from './actions/api-controller.ts'
import legacyController from './actions/legacy-controller.ts'
import pagesController from './actions/controller.tsx'
import { assets } from './assets.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  middleware: [staticFiles('./public', { index: false }), render({ assets })],
})

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}

router.map(routes, pagesController)
router.map(routes.api, apiController)
router.map(routes.legacy, legacyController)
