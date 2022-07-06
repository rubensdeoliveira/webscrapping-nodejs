const createCsvWriter = require('csv-writer').createObjectCsvWriter
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

puppeteer.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()
  await page.goto('https://area-restrita.crecies.gov.br/pesquisa-de-corretor-imobiliaria')
  
  const cityTab = '#tab_busca_por_municipio'
  await page.waitForSelector(cityTab)
  await page.$eval(cityTab, elem => elem.click())

  const allCities = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#bs_municipio option')).map(element=>element.value).filter(element => Boolean(element))
  )

  const people = []
  let cityCount = 0
  for(city of allCities){
    await page.select("select#bs_municipio", city)

    await Promise.all([
      page.waitForNavigation({ timeout: 0 }),
      await page.$eval('#form_bs_municipio', elem => elem.submit())
    ])

    const personsByCity = await page.$$('table > tbody > tr')  
    for(person of personsByCity){
      const personName = await person.$$eval('td > a > h5.card-title', nodes => nodes.map(n => n.innerText.replace(/\s+/g,' ').trim())[0])
      
      const emailIndex = await person.$$eval('td > dl.dl-horizontal > dt', nodes => nodes.map(n => n.innerText.replace(/\s+/g,' ').trim()).findIndex(find => find === 'E-mail'))
      const comercialPhoneIndex = await person.$$eval('td > dl.dl-horizontal > dt', nodes => nodes.map(n => n.innerText.replace(/\s+/g,' ').trim()).findIndex(find => find === 'Telefones Comerciais'))
      const residencialPhoneIndex = await person.$$eval('td > dl.dl-horizontal > dt', nodes => nodes.map(n => n.innerText.replace(/\s+/g,' ').trim()).findIndex(find => find === 'Telefones Residenciais'))

      if (emailIndex > 0 || comercialPhoneIndex > 0 || residencialPhoneIndex > 0) {
        const infoValues = await person.$$eval('td > dl.dl-horizontal > dd', nodes => nodes.map(n => n.innerText.replace(/\s+/g,' ').trim()))
        people.push({ 
          name: personName || null, 
          mainEmail: emailIndex > 0 ? infoValues[emailIndex].split(',')[0].trim() : null,
          email: emailIndex > 0 ? infoValues[emailIndex] : null,
          comercialPhone: comercialPhoneIndex > 0 ? infoValues[comercialPhoneIndex] : null,
          residencialPhone: residencialPhoneIndex > 0 ? infoValues[residencialPhoneIndex] : null
        })
      }
    }

    cityCount = cityCount + 1

    const robotProgress = Math.ceil(cityCount / allCities.length * 100)

    console.clear()
    console.log(`Robô em andamento:  ${robotProgress}/100`)
  }

  console.log('Transformando dados gerados em csv...')

  const dateFormattedToFileName = new Date(Date.now()).toISOString().slice(0,16).replace(':','-')
  const csvWriter = createCsvWriter({
    path: `${dateFormattedToFileName}.csv`,
    header: [
        {id: 'name', title: 'Nome'},
        {id: 'mainEmail', title: 'E-mail principal'},
        {id: 'email', title: 'E-mails secundários'},
        {id: 'comercialPhone', title: 'Telefones comerciais'},
        {id: 'residencialPhone', title: 'Telefones residenciais'}
    ]
  })

  csvWriter
    .writeRecords(people)
    .then(() => {
        console.log('Arquivo CSV gerado com sucesso!')
    })
}).catch((err) => {
  console.error(err)
})