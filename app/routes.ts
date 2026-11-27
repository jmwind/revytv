import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  tv: get('/tv'),
  history: get('/history'),
  calendar: get('/calendar'),
  about: get('/about'),
  api: route('/api', {
    snowReport: get('/snow-report'),
    summerForecast: get('/summer-forecast'),
    calendarData: get('/calendar-data'),
    historical: get('/historical'),
  }),
  // Old static-site URLs that people (and the living-room TV) have bookmarked.
  legacy: route({
    tv: get('/tv.html'),
    about: get('/about.html'),
    calendar: get('/calendar.html'),
    settings: get('/settings.html'),
    signIn: get('/sign-in.html'),
  }),
})
