import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'

// Permanent redirects from the old static-site URLs.
export default createController(routes.legacy, {
  actions: {
    tv: () => redirect(routes.tv.href(), 301),
    about: () => redirect(routes.about.href(), 301),
    calendar: (context) => redirect(`${routes.calendar.href()}${context.url.search}`, 301),
    settings: () => redirect(routes.home.href(), 301),
    signIn: () => redirect(routes.home.href(), 301),
  },
})
