import { expect, test } from '@playwright/test'

const frontendScanId = 'd37d71d45fe14f88af937ba1210c1d4a'
const axiosFindingId = '245e12b4-8baa-5058-a4fc-be424b591423'

test.describe('SecSource dashboard', () => {
  test('renders overview and supports creating then cancelling a scan', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    const riskPosture = page.getByRole('region', { name: 'Risk posture' })
    await expect(riskPosture).toBeVisible()
    await expect(riskPosture.getByText('153', { exact: true })).toBeVisible()
    await expect(
      riskPosture.locator('.severity-item').filter({ hasText: 'Critical' }).getByText('1', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      riskPosture.locator('.severity-item').filter({ hasText: 'High' }).getByText('61', {
        exact: true,
      }),
    ).toBeVisible()

    const needsAttention = page.getByRole('region', { name: 'Needs attention' })
    await expect(needsAttention).toBeVisible()
    await expect(
      needsAttention.getByRole('button', { name: /^Critical\b/ }).getByText('1', { exact: true }),
    ).toBeVisible()
    await expect(
      needsAttention.getByRole('button', { name: /^High\b/ }).getByText('61', { exact: true }),
    ).toBeVisible()

    await expect(page.getByRole('region', { name: 'Recent scans' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Scanner health' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Workspace overview' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'JobCV Frontend' })).toBeVisible()

    await expect(page).toHaveScreenshot('overview.png', {
      animations: 'disabled',
      fullPage: false,
    })

    await page.getByRole('button', { name: /new scan/i }).click()
    await expect(page.getByText('New security scan', { exact: true })).toBeVisible()

    await expect(page).toHaveScreenshot('overview-new-scan.png', {
      animations: 'disabled',
      fullPage: false,
    })

    await page.getByRole('button', { name: 'Choose project directory' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Project directory', exact: true }),
    ).toHaveValue(
      '/home/developer/projects/secsource-sample',
    )
    await page.getByRole('button', { name: 'Start scan' }).click()

    await expect(page).toHaveURL(/\/scans\?job=local-scan-001/)
    await expect(page.getByRole('heading', { name: 'Secsource Sample' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel scan' }).click()
    const confirmation = page.getByRole('alertdialog', { name: 'Cancel scan?' })
    await confirmation.getByRole('button', { name: 'Cancel scan' }).click()
    await expect(page.getByText(/^cancelled$/i).first()).toBeVisible()
  })

  test('renders jobs, filters them, and opens a completed report', async ({ page }) => {
    await page.goto('/scans')

    await expect(page.getByRole('heading', { name: 'Scans' })).toBeVisible()
    await expect(page.getByText('13 of 13 jobs shown')).toBeVisible()

    const pagination = page.locator('.pagination-bar')
    await expect(pagination).toBeVisible()
    await expect(pagination).toContainText('Page 1 of 2')

    const projectRow = (projectName: string) =>
      page.locator('tbody tr').filter({
        has: page.getByRole('button', { name: projectName }),
      })

    await expect(projectRow('API Gateway')).toContainText(/completed/i)
    await expect(projectRow('API Gateway')).toContainText(/deep/i)
    await expect(projectRow('Billing Service')).toContainText(/failed/i)
    await expect(projectRow('Billing Service')).toContainText(/shallow/i)
    await expect(projectRow('Mobile API')).toContainText(/cancelled/i)
    await expect(projectRow('Mobile API')).toContainText(/auto/i)

    await pagination.locator('.n-pagination-item--clickable').filter({ hasText: '2' }).click()
    await expect(pagination).toContainText('Page 2 of 2')
    await expect(page.getByRole('button', { name: 'Notifications Service' })).toBeVisible()
    await pagination.locator('.n-pagination-item--clickable').filter({ hasText: '1' }).click()
    await expect(pagination).toContainText('Page 1 of 2')

    const scanActivity = page.getByRole('log', { name: 'Scan activity' })
    await expect(scanActivity).toBeVisible()
    await expect(scanActivity.getByText('Project archive uploaded', { exact: true })).toBeVisible()
    await expect(
      scanActivity.getByText('Deep security analysis completed', { exact: true }),
    ).toBeVisible()
    await expect(scanActivity.getByText(/Report ready with \d+ findings/)).toBeVisible()
    await expect
      .poll(async () => (await scanActivity.boundingBox())?.height ?? 0)
      .toBeGreaterThan(72)

    await expect(page).toHaveScreenshot('scans.png', {
      animations: 'disabled',
      fullPage: false,
    })

    await scanActivity.focus()
    await expect(scanActivity).toBeFocused()

    await page.getByPlaceholder('Search project, path, or job ID').fill('backend')
    await expect(page.getByRole('button', { name: 'JobCV Backend' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'JobCV Frontend' })).toHaveCount(0)
    await page.getByRole('button', { name: 'JobCV Backend' }).click()

    await page.getByRole('button', { name: 'View findings' }).click()
    await expect(page).toHaveURL(/\/findings\/f713ca47b/)
    await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible()
  })

  test('renders a real finding and its investigation evidence', async ({ page }) => {
    await page.goto(`/findings/${frontendScanId}/${axiosFindingId}`)

    await expect(page.getByRole('heading', { name: 'CVE-2026-25639' })).toBeVisible()
    await page.getByRole('tab', { name: /evidence chain|call chain/i }).click()

    const evidenceSummary = page.getByLabel('Evidence summary')
    await expect(evidenceSummary).toContainText('4 steps')
    await expect(evidenceSummary).toContainText('4 verified nodes')
    await expect(evidenceSummary).toContainText('Reachability unavailable')
    await expect(
      page.getByText('Ordered investigation evidence; not a confirmed runtime call graph.'),
    ).toBeVisible()

    const axiosCreateStep = page.getByRole('button', {
      name: 'Step 2, introducer, src/api/index.ts line 17',
    })
    await axiosCreateStep.click()

    const inspector = page.getByLabel('Selected evidence step')
    await expect(inspector).toContainText('Step 02')
    await expect(inspector).toContainText('introducer')
    await expect(inspector).toContainText('axios.create() with literal baseURL/timeout/headers config')
    await expect(inspector.getByText('src/api/index.ts:17')).toBeVisible()

    await page.getByRole('button', { name: 'Play evidence' }).click()
    const stopEvidence = page.getByRole('button', { name: 'Stop evidence' })
    await expect(stopEvidence).toBeVisible()
    await stopEvidence.click()
    await expect(page.getByRole('button', { name: 'Play evidence' })).toBeVisible()

    // Keep the screenshot stable and demonstrate that a graph node drives the inspector.
    await axiosCreateStep.click()
    await expect(inspector).toContainText('Step 02')

    await expect(page).toHaveScreenshot('finding-evidence.png', {
      animations: 'disabled',
      fullPage: false,
    })
  })

  test('validates settings and authenticates with a transient token', async ({ page }) => {
    await page.goto('/settings')

    await expect(page.getByRole('heading', { name: 'Settings & authentication' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Scanner server' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Authentication', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Runtime', exact: true })).toBeVisible()

    const endpoint = page.getByLabel('Server endpoint')
    await endpoint.fill('not-a-url')
    await page.getByRole('button', { name: 'Test connection' }).click()
    await expect(page.getByText('Enter a valid HTTP or HTTPS URL.')).toBeVisible()
    await endpoint.fill('https://scanner.example.test')

    await page.getByRole('tab', { name: 'Access token' }).click()
    await page.getByRole('button', { name: 'Use access token' }).click()
    await expect(page.getByText('Access token is required.')).toBeVisible()
    const token = page.getByRole('textbox', { name: 'Access token', exact: true })
    await token.fill('e2e-memory-only-token')
    await page.getByRole('button', { name: 'Use access token' }).click()
    await expect(page.getByText('Authentication successful.')).toBeVisible()
    await expect(token).toHaveValue('')
    await page.evaluate(() => window.scrollTo(0, 0))

    await expect(page).toHaveScreenshot('settings.png', {
      animations: 'disabled',
      fullPage: false,
    })
  })
})
