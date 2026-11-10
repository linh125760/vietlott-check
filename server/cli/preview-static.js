/**
 * Xem thử bản build tĩnh giống GitHub Pages (phục vụ dưới đường dẫn con /<repo>/):
 *   npm run build && npm run preview:static   → http://localhost:4173/vietlott-checker/
 */
const path = require('path');
const express = require('express');

const base = '/' + (process.env.BASE || 'vietlott-checker') + '/';
const port = Number(process.env.PORT) || 4173;
const app = express();
app.use(base, express.static(path.join(__dirname, '..', '..', 'dist')));
app.get('/', (req, res) => res.redirect(base));
app.listen(port, () => console.log(`Bản tĩnh: http://localhost:${port}${base}`));
