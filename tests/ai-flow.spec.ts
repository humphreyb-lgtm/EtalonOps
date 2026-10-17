import { test,expect,type Route } from '@playwright/test';
test('opt-in AI flow preserves context, shows unverified wording and keeps fallback after a failed call',async({page})=>{
  const pending:Route[]=[];const bodies:Record<string,any>[]=[];
  await page.route('**/api/lookup/status',route=>route.fulfill({json:{enabled:true,discoveryAvailable:false,limits:{monthlySessions:200,monthlyRequests:400,sessionRequests:2,userDailyRequests:20}}}));
  await page.route('**/api/lookup/clarify',route=>{pending.push(route);bodies.push(route.request().postDataJSON());});
  await page.goto('/?database=1&identity=foreman-two');await expect(page.locator('main')).toHaveAttribute('aria-busy','false');const initialLines=await page.getByTestId('mrf-line').count();
  await page.getByLabel('Quantity',{exact:true}).fill('10');await page.getByLabel('Unit',{exact:true}).selectOption('EA');await page.getByLabel('Description',{exact:true}).fill('black 6-32 device screws');await page.getByRole('button',{name:'Find Matches',exact:true}).click();await page.getByRole('radio',{name:/Other \/ none of these/}).check();
  const composer=page.getByLabel('Tell the assistant what you are looking for');await composer.fill('One inch long.');await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect.poll(()=>pending.length).toBe(1);await expect(page.getByRole('status').filter({hasText:'Interpreting your material request'})).toBeVisible();
  await pending[0].fulfill({json:{summary:'Black 6-32 device screws, 1 inch long.',description:'Black 6-32 device screws, 1 inch long.',reply:'Your details are retained. Use My Description.',question:null,source:'ai',discoveryAvailable:false}});
  await expect(page.getByText('AI wording · unverified',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Description to add',{exact:true})).toHaveValue(/Clarification: One inch long/);
  await composer.fill('For room 201.');await page.getByRole('button',{name:'Send message',exact:true}).click();await expect.poll(()=>pending.length).toBe(2);
  expect(bodies[0].sessionId).toBe(bodies[1].sessionId);expect(bodies[0].turnId).not.toBe(bodies[1].turnId);expect(bodies[1].description).toBe('black 6-32 device screws');expect(bodies[1].requestedUnit).toBe('EA');expect(bodies[1].quantity).toBe('10');expect(JSON.stringify(bodies[1].turns)).toContain('One inch long.');expect(bodies[1]).not.toHaveProperty('owner');
  await pending[1].fulfill({status:429,json:{error:'This lookup reached its two AI turns. Use My Description.'}});
  await expect(page.getByRole('alert')).toContainText('two AI turns');await expect(composer).toBeEnabled();
  await page.getByRole('button',{name:'Use My Description',exact:true}).click();await expect(page.getByTestId('mrf-line')).toHaveCount(initialLines+1);await expect(page.getByTestId('mrf-line').last()).toContainText('For room 201.');await expect(page.getByTestId('mrf-line').last()).toContainText('Your description');expect(pending.length).toBe(2);
});
