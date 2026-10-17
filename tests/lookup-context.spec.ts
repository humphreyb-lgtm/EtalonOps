import { test, expect } from '@playwright/test';

test('clarification retains supplied facts across options and persists edited fallback plus original input',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Quantity',{exact:true}).fill('12');
  await page.getByLabel('Unit',{exact:true}).selectOption('EA');
  await page.getByLabel('Description',{exact:true}).fill('black 6-32 device screws');
  await page.getByRole('button',{name:'Find Matches',exact:true}).click();
  await page.getByRole('radio',{name:/Other \/ none of these/}).check();
  await expect(page.getByRole('log')).toContainText('What length do you need?');
  const composer=page.getByLabel('Tell the assistant what you are looking for');
  await composer.fill('One inch long, for room 201.');await composer.press('Enter');
  await expect(page.getByRole('log').locator('.message-bubble').last()).not.toContainText('What length');
  await page.getByRole('radio',{name:/1\/4 in\. hex-head/}).check();
  await expect(page.getByRole('log')).toContainText('One inch long, for room 201.');
  await expect(page.getByRole('log').locator('.message-bubble').last()).not.toContainText('What thread');
  await expect(page.getByLabel('Description to add',{exact:true})).toHaveValue(/room 201/);
  await page.getByLabel('Description to add',{exact:true}).fill('Black 6-32 device screws, 1 inch long; room 201.');
  await page.getByRole('button',{name:'Use My Description',exact:true}).click();
  await expect(page.getByTestId('mrf-line')).toContainText('room 201');
  await page.getByRole('button',{name:'Save as Draft',exact:true}).click();
  await page.reload();
  await expect(page.getByTestId('mrf-line')).toContainText('Black 6-32 device screws, 1 inch long; room 201.');
  await page.getByText('Original input',{exact:true}).click();
  await expect(page.getByTestId('mrf-line')).toContainText('12 EA · black 6-32 device screws');
});

test('unknown answers advance once per missing detail without fabricated dimensions',async({page})=>{
  await page.goto('/');
  await page.getByLabel('Quantity',{exact:true}).fill('2');
  await page.getByLabel('Unit',{exact:true}).selectOption('BOX');
  await page.getByLabel('Description',{exact:true}).fill('self tappers');
  await page.getByRole('button',{name:'Find Matches',exact:true}).click();
  await page.getByRole('radio',{name:/Other \/ none of these/}).check();
  const composer=page.getByLabel('Tell the assistant what you are looking for');
  for(const question of ['What thread or diameter','What length','What material or finish']){
    await expect(page.getByRole('log').locator('.message-bubble').last()).toContainText(question);
    await composer.fill('not sure');await composer.press('Enter');
  }
  await expect(page.getByRole('log').locator('.message-bubble').last()).toContainText('Unspecified details will stay unspecified');
  await page.getByRole('button',{name:'Use My Description',exact:true}).click();
  await expect(page.getByTestId('mrf-line')).toContainText('Your description');
  await expect(page.getByTestId('mrf-line')).not.toContainText('6-32');
});
