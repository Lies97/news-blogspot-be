const cheerio = require('cheerio');
const express = require('express');
const puppeteer = require('puppeteer');
const { Cluster } = require('puppeteer-cluster');

const app = express();

app.enableCors();
const url = 'https://www.theguardian.com/uk';

const webScarping = async (res) => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.goto(url);

  const html = await page.content();
  const $ = cheerio.load(html);

  const articles = [];
  
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_BROWSER,
    maxConcurrency: 100,
  });

  $('.fc-item__container', html).each(function () {
    const title = $(this).find('.fc-item__title').text();
    const url = $(this).find('a').attr('href');
    const thumbnail = $(this)
      .find('.fc-item__image-container > picture > img')
      .attr('src');

    const article = { title, url, thumbnail };
    cluster.queue(article);
  });


  await cluster.task(async ({ page, data: article }) => {
    const { title, url, thumbnail } = article;
    await page.goto(url, {
      waitUntil: 'load',
      timeout: 0
    });
    const html = await page.content();
    const $ = cheerio.load(html);

    const content = $('.article-body-commercial-selector').text();

    articles.push({ title, content, url, thumbnail });
    await page.close();
  });

  await cluster.idle();
  await cluster.close();
  res.send(articles);
};

app.get('/articles', (req, res) => {
  webScarping(res);
});

app.listen(process.env.PORT || 8000, () => {
  console.log(`Web Scarper is running on PORT ${process.env.PORT}`);
});
