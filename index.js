const cheerio = require('cheerio');
const express = require('express');
const chromium = require('chrome-aws-lambda');
require('dotenv').config();
const cors = require('cors');
var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200,
};
const app = express();

const port = process.env.PORT || 4000;

app.use(cors(corsOptions));
const url = 'https://www.theguardian.com/uk';

const getBrowserInstance = async () => {
  const executablePath = await chromium.executablePath;

  if (!executablePath) {
    // running locally
    const puppeteer = require('puppeteer');
    return puppeteer.launch({
      args: chromium.args,
      headless: true,
      defaultViewport: {
        width: 1280,
        height: 720,
      },
      ignoreHTTPSErrors: true,
    });
  }

  return chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: {
      width: 1280,
      height: 720,
    },
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
};

const webScarping = async (res) => {
  const browser = await getBrowserInstance();

  const articles = [];

  const page = await browser.newPage();

  await page.goto(url);

  const html = await page.content();
  const $ = cheerio.load(html);

  $('.fc-item__container', html).each(function () {
    const title = $(this)
      .find('.fc-item__title')
      .text()
      .replace('\n', '')
      .trim();
    const url = $(this).find('a').attr('href');
    const thumbnail = $(this)
      .find('.fc-item__image-container > picture > img')
      .attr('src');

    const description = $(this)
      .find('.fc-item__standfirst')
      .text()
      .replace('\n', '')
      .trim();
    if (thumbnail && description) {
      articles.push({ title, url, thumbnail, description });
    }
  });

  await browser.close();
  res.send(articles);
};

const scarpArticle = async (urlLink, res) => {
  const browser = await getBrowserInstance();

  const page = await browser.newPage();
  await page.goto(url);

  const html = await page.content();
  const $ = cheerio.load(html);

  $('.fc-item__container', html).each(async function () {
    const title = $(this).find('.fc-item__title').text();
    const link = $(this).find('a').attr('href');
    const thumbnail = $(this)
      .find('.fc-item__image-container > picture > img')
      .attr('src');

    if (link.includes(urlLink)) {
      await page.goto(link);
      const sections = [];

      const newHtml = await page.content();

      const $$ = cheerio.load(newHtml);
      $$('.article-body-commercial-selector > p', newHtml).each(function (a) {
        sections.push($$(this).text());
      });

      const image = $$('picture > img').attr('src');

      const article = {
        title,
        url: link,
        thumbnail,
        contentSections: sections,
        image,
      };

      await page.close();
      res.send(article);
    }
  });
};

app.get('/api/articles', (req, res) => {
  try {
    webScarping(res);
  } catch (err) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

app.get('/api/article/:url', (req, res) => {
  try {
    scarpArticle(req.params.url, res);
  } catch (err) {
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Web Scarper is running on PORT ${port}`);
});
