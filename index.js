const cheerio = require('cheerio');
const express = require('express');
const puppeteer = require('puppeteer');
require('dotenv').config();

const cors = require('cors');
var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
};
const app = express();

const port = process.env.PORT || 3000;

const articles = [];

app.use(cors(corsOptions));
const url = 'https://www.theguardian.com/uk';

const webScarping = async (res) => {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.goto(url);

  const html = await page.content();
  const $ = cheerio.load(html);

  $('.fc-item__container', html).each(async function () {
    const title = $(this).find('.fc-item__title').text();
    const url = $(this).find('a').attr('href');
    const thumbnail = $(this)
      .find('.fc-item__image-container > picture > img')
      .attr('src');

    const article = { title, url, thumbnail };
    articles.push(article);
    articles.forEach((article, i) => {
      article['id'] = i;
    });
  });

  console.log('articles', articles);
  articles = Array.from(new Set(articles.map(a => a.title)))
  .map(title => {
    return articles.find(a => a.title === title)
  })
  res.send(articles);
};

const scarpArticle = async (urlLink, res) => {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  if (articles.length > 0) {
    const article = articles.find((article) => article.url.includes(urlLink));
    const newPage = await browser.newPage();
    await newPage.goto(article.url);

    const html = await newPage.content();
    const $ = cheerio.load(html);
    const content = $('.article-body-commercial-selector').text();
    console.log('content', content);
    article['content'] = content;
    res.send(article);
    newPage.close();
  } else {
    const page = await browser.newPage();
    const articlesArray = [];
    await page.goto(url);

    const html = await page.content();
    const $ = cheerio.load(html);

    $('.fc-item__container', html).each(async function () {
      const title = $(this).find('.fc-item__title').text();
      const link = $(this).find('a').attr('href');
      const thumbnail = $(this)
        .find('.fc-item__image-container > picture > img')
        .attr('src');

      const article = { title, url: link, thumbnail };

      setTimeout(async () => {
        if (article.url.includes(urlLink)) {
          const newPage = await browser.newPage();
          await newPage.goto(article.url);

          console.log(article.url);
          const html = await newPage.content();
          const $$ = cheerio.load(html);
          const content = $$('.article-body-commercial-selector').text();
          console.log('content', content);
          article['content'] = content;
          articlesArray.push(article);

          newPage.close();
          res.send(article);
        }
      }, 1000);
    });
  }
};

app.get('/articles', (req, res) => {
  webScarping(res);
});

app.get('/article/:url', (req, res) => {
  scarpArticle(req.params.url, res);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Web Scarper is running on PORT ${port}`);
});
