import { expect, test, type Locator, type Page } from '@playwright/test'

const frontendScanId = 'd37d71d45fe14f88af937ba1210c1d4a'
const backendScanId = 'f713ca47b5ec4c0f8fea985eb8c1f5aa'
const axiosFindingId = '245e12b4-8baa-5058-a4fc-be424b591423'

async function selectOption(page: Page, control: Locator, option: string) {
  await control.click()
  await page.locator('.n-base-select-option').getByText(option, { exact: true }).click()
}

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

    const radii = await page.locator(':root').evaluate((root) => {
      const styles = getComputedStyle(root)
      return {
        panel: styles.getPropertyValue('--radius-panel').trim(),
        control: styles.getPropertyValue('--radius-control').trim(),
        compact: styles.getPropertyValue('--radius-compact').trim(),
      }
    })
    expect(radii).toEqual({ panel: '4px', control: '3px', compact: '2px' })

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
    ).toHaveValue('/home/developer/projects/secsource-sample')
    await page.getByRole('button', { name: 'Start scan' }).click()

    await expect(page).toHaveURL(/\/scans\?job=local-scan-001/)
    await expect(page.getByRole('heading', { name: 'Secsource Sample' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel scan' }).click()
    const confirmation = page.getByRole('alertdialog', { name: 'Cancel scan?' })
    await confirmation.getByRole('button', { name: 'Cancel scan' }).click()
    await expect(page.getByText(/^cancelled$/i).first()).toBeVisible()
  })

  test('renders scan history and supports scalable filters and pagination', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-19T09:00:00+07:00') })
    await page.goto('/scans')

    await expect(page.getByRole('heading', { name: 'Scans' })).toBeVisible()
    const summary = page.getByRole('region', { name: 'Scan job summary' })
    await expect(summary).toContainText('Total jobs13')
    await expect(summary).toContainText('Active0')
    await expect(summary).toContainText('Completed9')
    await expect(summary).toContainText('Failed2')

    const pagination = page.locator('footer[aria-label="Scan job pagination"]')
    await expect(pagination).toContainText('1–8 of 13 jobs')

    const scanActivity = page.getByRole('log', { name: 'Scan activity' })
    await expect(scanActivity).toBeVisible()
    await expect(scanActivity.getByText('Project archive uploaded', { exact: true })).toBeVisible()
    await expect(
      scanActivity.getByText('Deep security analysis completed', { exact: true }),
    ).toBeVisible()
    await expect(scanActivity.getByText(/Report ready with \d+ findings/)).toBeVisible()

    await expect(page).toHaveScreenshot('scans.png', {
      animations: 'disabled',
      fullPage: false,
    })

    await pagination.locator('.n-pagination-item--clickable').filter({ hasText: '2' }).click()
    await expect(pagination).toContainText('9–13 of 13 jobs')
    await expect(page.getByRole('button', { name: 'Notifications Service' })).toBeVisible()
    await pagination.locator('.n-pagination-item--clickable').filter({ hasText: '1' }).click()

    const scanFilters = page.getByRole('region', { name: 'Scan filters' })
    const projectSelect = scanFilters.getByRole('combobox', { name: 'Filter by project' })
    const statusSelect = scanFilters.getByRole('combobox', { name: 'Filter by job status' })
    const modeSelect = scanFilters.getByRole('combobox', { name: 'Filter by scan mode' })
    const dateSelect = scanFilters.getByRole('combobox', { name: 'Filter by scan date' })

    await selectOption(page, projectSelect, 'API Gateway')
    await expect(pagination).toContainText('1–1 of 1 jobs')
    await expect(page.getByRole('button', { name: 'API Gateway' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear' }).click()

    await selectOption(page, statusSelect, 'Failed')
    await expect(pagination).toContainText('1–2 of 2 jobs')
    await expect(page.getByRole('button', { name: 'Billing Service' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Event Consumer' })).toBeVisible()
    await selectOption(page, modeSelect, 'Shallow')
    await expect(pagination).toContainText('1–1 of 1 jobs')
    await expect(page.getByRole('button', { name: 'Billing Service' })).toBeVisible()
    await page.getByRole('button', { name: 'Clear' }).click()

    await selectOption(page, dateSelect, 'Last 7 days')
    await expect(pagination).toContainText('1–7 of 7 jobs')
    await page.getByRole('button', { name: 'Clear' }).click()

    await page.getByPlaceholder('Search project, path, or job ID').fill('backend')
    await expect(pagination).toContainText('1–1 of 1 jobs')
    await expect(page.getByRole('button', { name: 'JobCV Backend' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'JobCV Frontend' })).toHaveCount(0)
  })

  test('opens and downloads a report, then moves between scan and global findings', async ({
    page,
  }) => {
    await page.goto('/scans')
    await page.getByRole('button', { name: 'JobCV Backend' }).click()

    await page.getByRole('button', { name: 'View raw report' }).click()
    const rawDialog = page.getByRole('dialog', { name: 'Raw report' })
    await expect(rawDialog).toBeVisible()
    await expect(rawDialog).toContainText('JobCV Backend')
    await expect(rawDialog.locator('pre')).toContainText(`"scan_id": "${backendScanId}"`)
    await expect(rawDialog.locator('pre')).toContainText('"findings"')
    await page.getByRole('button', { name: 'Close raw report' }).click()
    await expect(rawDialog).toBeHidden()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download report' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(`secsource-jobcv-backend-${backendScanId}.json`)

    await page.getByRole('button', { name: 'View findings' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/findings/${backendScanId}\\?scope=scan&job=${backendScanId}`),
    )
    const scanScope = page.getByRole('button', {
      name: /Scan: JobCV Backend .* Show latest results per project/,
    })
    await expect(scanScope).toBeVisible()
    await expect(page.getByText('56 of 56 findings', { exact: true })).toBeVisible()

    const scanFinding = page
      .getByRole('region', { name: 'Findings list' })
      .getByRole('button', { name: /Open .+ in JobCV Backend/ })
      .first()
    await scanFinding.click()
    await expect(page.getByRole('link', { name: 'Back to findings' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Findings list' })).toHaveCount(0)
    let detailUrl = new URL(page.url())
    expect(detailUrl.pathname).toMatch(new RegExp(`^/findings/${backendScanId}/[^/]+$`))
    expect(detailUrl.searchParams.get('scope')).toBe('scan')
    expect(detailUrl.searchParams.get('job')).toBe(backendScanId)

    await page.getByRole('link', { name: 'Back to findings' }).click()
    await expect(page).toHaveURL(
      new RegExp(`/findings/${backendScanId}\\?scope=scan&job=${backendScanId}`),
    )
    await expect(scanScope).toBeVisible()

    await scanScope.click()
    await expect(page).toHaveURL(/\/findings$/)
    await expect(page.getByText('Latest results per project', { exact: true })).toBeVisible()

    const findingFilters = page.getByRole('region', { name: 'Finding filters' })
    await selectOption(
      page,
      findingFilters.getByRole('combobox', { name: 'Filter project' }),
      'JobCV Backend',
    )
    await expect(page.getByText('56 of 153 findings', { exact: true })).toBeVisible()

    await page
      .getByRole('region', { name: 'Findings list' })
      .getByRole('button', { name: /Open .+ in JobCV Backend/ })
      .first()
      .click()
    detailUrl = new URL(page.url())
    expect(detailUrl.searchParams.get('scope')).toBe('latest')
    expect(detailUrl.searchParams.get('project')).toBe('jobcv-backend')
    await page.getByRole('button', { name: 'Open scan' }).click()
    await expect(page).toHaveURL(new RegExp(`/scans\\?job=${backendScanId}$`))
    await expect(page.getByRole('heading', { name: 'JobCV Backend' })).toBeVisible()
  })

  test('renders global latest findings with project filtering and 25-row pages', async ({ page }) => {
    await page.goto('/findings')

    await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible()
    await expect(page.getByText('Latest results per project', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Scan report')).toHaveCount(0)

    const severitySummary = page.getByRole('region', { name: 'Severity summary' })
    const expectedTotals = {
      Critical: '1',
      High: '61',
      Medium: '86',
      Low: '5',
      Total: '153',
    }
    for (const [label, total] of Object.entries(expectedTotals)) {
      await expect(
        severitySummary.locator('.severity-summary__item').filter({ hasText: label }),
      ).toContainText(total)
    }

    const findingsList = page.getByRole('region', { name: 'Findings list' })
    await expect(findingsList.getByText('1–25 of 153', { exact: true })).toBeVisible()
    await expect(findingsList.locator('tbody tr')).toHaveCount(25)

    await expect(page).toHaveScreenshot('findings-global.png', {
      animations: 'disabled',
      fullPage: false,
    })

    const findingFilters = page.getByRole('region', { name: 'Finding filters' })
    await selectOption(
      page,
      findingFilters.getByRole('combobox', { name: 'Filter project' }),
      'TeacherAI Frontend',
    )
    await expect(page.getByText('13 of 153 findings', { exact: true })).toBeVisible()
    await expect(findingsList.getByText('1–13 of 13', { exact: true })).toBeVisible()
    await expect(findingsList.locator('tbody tr')).toHaveCount(13)
    for (const row of await findingsList.locator('tbody tr').all()) {
      await expect(row).toContainText('TeacherAI Frontend')
    }

    await selectOption(
      page,
      findingFilters.getByRole('combobox', { name: 'Filter project' }),
      'JobCV Backend',
    )
    const findingsPagination = findingsList.locator('footer')
    await findingsPagination.locator('.n-pagination-item--clickable').filter({ hasText: '2' }).click()
    await expect(findingsList.getByText('26–50 of 56', { exact: true })).toBeVisible()

    const pageTwoFinding = findingsList
      .getByRole('button', { name: /Open .+ in JobCV Backend/ })
      .first()
    const openedRule = (await pageTwoFinding.locator('.finding-rule').textContent())?.trim()
    expect(openedRule).toBeTruthy()
    await pageTwoFinding.click()

    await expect(page).toHaveURL(new RegExp(`/findings/${backendScanId}/[^?]+\\?`))

    const detailUrl = new URL(page.url())
    expect(detailUrl.pathname).toMatch(new RegExp(`^/findings/${backendScanId}/[^/]+$`))
    expect(detailUrl.searchParams.get('scope')).toBe('latest')
    expect(detailUrl.searchParams.get('project')).toBe('jobcv-backend')
    expect(detailUrl.searchParams.get('page')).toBe('2')
    await expect(page.getByRole('heading', { name: openedRule! })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to findings' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Findings list' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Back to findings' }).click()
    const restoredUrl = new URL(page.url())
    expect(restoredUrl.pathname).toBe('/findings')
    expect(restoredUrl.searchParams.get('project')).toBe('jobcv-backend')
    expect(restoredUrl.searchParams.get('page')).toBe('2')
    await expect(findingsList.getByText('26–50 of 56', { exact: true })).toBeVisible()
  })

  test('keeps legacy finding deep links and renders investigation evidence', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto(`/findings/${frontendScanId}/${axiosFindingId}`)

    await expect(page.getByRole('heading', { name: 'CVE-2026-25639' })).toBeVisible()
    await page.getByRole('tab', { name: 'Evidence trace' }).click()
    await expect(page).toHaveURL(new RegExp(`\\?tab=evidence$`))

    const evidenceTrace = page.getByRole('region', { name: 'Evidence trace' })
    const evidenceSummary = evidenceTrace.getByLabel('Evidence summary')
    await expect(evidenceSummary).toContainText('4 evidence points')
    await expect(evidenceSummary).toContainText('4 verified')
    await expect(evidenceSummary).toContainText('Reachability unavailable')
    await expect(
      evidenceTrace.getByText(
        'Ordered investigation evidence; not a confirmed runtime call graph.',
        { exact: true },
      ),
    ).toBeVisible()

    const axiosCreateStep = page.getByRole('button', {
      name: /Step 2 of 4, introducer, src\/api\/index\.ts:17, Verified location/i,
    })
    await axiosCreateStep.click()

    const inspector = page.getByLabel('Selected evidence step')
    await expect(inspector).toContainText('Step 02')
    await expect(inspector).toContainText('introducer')
    await expect(inspector).toContainText(
      'axios.create() with literal baseURL/timeout/headers config',
    )
    await expect(inspector.getByText('src/api/index.ts:17')).toBeVisible()

    await page.getByRole('button', { name: 'Previous evidence' }).click()
    await expect(inspector).toContainText('Step 01')
    await expect(page.getByRole('button', { name: 'Previous evidence' })).toBeDisabled()

    await page.getByRole('button', { name: 'Next evidence' }).click()
    await expect(inspector).toContainText('Step 02')

    await page.getByRole('button', { name: 'Copy location' }).click()
    await expect(page.getByRole('status')).toHaveText('Source location copied.')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('src/api/index.ts:17')
    await axiosCreateStep.click()
    await expect(page.getByRole('status')).toHaveText('')

    await expect(page.getByRole('button', { name: /Play evidence|Stop evidence|Open source/ })).toHaveCount(0)
    await expect(page.locator('.vue-flow')).toHaveCount(0)

    await expect(page).toHaveScreenshot('finding-evidence.png', {
      animations: 'disabled',
      fullPage: false,
    })
  })

  test('shows an explicit state for an invalid finding deep link', async ({ page }) => {
    await page.goto(`/findings/${frontendScanId}/missing-finding?scope=scan`)

    await expect(page.getByRole('heading', { name: 'Finding not found' })).toBeVisible()
    await expect(page.getByText('This report does not contain the requested finding.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Return to findings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'CVE-2026-25639' })).toHaveCount(0)
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
