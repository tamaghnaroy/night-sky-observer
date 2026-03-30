async page => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 40.7128, longitude: -74.0060 });
  await page.reload();
  await page.waitForTimeout(4000);
}
