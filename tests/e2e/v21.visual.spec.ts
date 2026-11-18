import {test,expect} from '@playwright/test';
test('registered v2.1 visual baselines compare real renderers on desktop and phone',async({page})=>{
  test.setTimeout(180000);await page.goto('/renderer-lab');await expect(page.getByRole('heading',{name:'知识的多种观察方式'})).toBeVisible();
  const views=[['关系图谱','graph'],['时间脉络','timeline'],['思维导图','mindmap'],['依赖图','dependency'],['证据网络','evidence'],['数据表','table'],['科学图表','chart']];
  for(const theme of ['light','dark'])for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.getByLabel('主题',{exact:true}).selectOption(theme);for(const [label,key]of views){await page.getByRole('navigation',{name:'实验室视图'}).getByRole('button',{name:label,exact:true}).click();await page.getByRole('heading',{name:'知识的多种观察方式'}).click();await expect(page.locator('.lab-canvas')).toHaveScreenshot(key+'-'+theme+'-'+width+'.png',{animations:'disabled',caret:'hide',maxDiffPixelRatio:.008});}}
});
