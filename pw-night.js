async page => {
  await page.locator('#manual-lat').fill('-43.5321');
  await page.locator('#manual-lon').fill('172.6362');
  await page.locator('#modal-apply').click();
  await page.waitForTimeout(2000);
}
