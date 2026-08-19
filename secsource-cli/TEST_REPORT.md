# `secsource-cli` — nghiên cứu, kiểm thử và contract Input → Output

> Kiểm tra ngày 2026-08-19 trên Linux x86-64. Tài liệu này mô tả hành vi **đã quan sát trực tiếp** của binary `secsource-cli` phiên bản `0.1.0`, không chỉ chép lại màn hình `--help`.

## 1. Kết luận nhanh

Luồng cơ bản của CLI là:

```text
setup hoặc login
        ↓
scan PROJECT → upload archive → nhận JOB_ID
        ↓
get JOB_ID → tải report JSON/SARIF
```

Điểm quan trọng nhất cho UI/dashboard:

- `scan` mặc định chỉ submit job và trả `JOB_ID`; nó chưa trả report.
- `get JOB_ID` gọi thẳng endpoint tải result. Nếu job chưa xong, server có thể trả `409`.
- Cách lấy JSON sạch, ít lỗi nhất là `get JOB_ID -o report.json`, rồi đọc file.
- `scan --wait` chờ bằng long-poll. Nếu không có `-o`, stdout chứa **cả log text lẫn report**, không thể parse toàn bộ stdout như JSON.
- CLI hiện không có lệnh `list`, cũng không expose lệnh xem trạng thái một job. Dashboard muốn danh sách/progress phải bổ sung bridge/API riêng.
- Web hiện tại vẫn khởi tạo `MockSecSourceClient`; chưa chạy binary thật.

## 2. Phạm vi project thực tế

Thư mục `secsource-cli/` được bàn giao gồm:

```text
secsource-cli/
├── secsource-cli                    # binary Linux
├── command.txt                      # quick reference
├── help.png
├── TEST_REPORT.md
├── reports/
│   ├── jobcv_backend.json
│   ├── jobcv_frontend.json
│   └── teacherAI_frontend.json
└── tests/                            # mock server + fixture phục vụ kiểm thử
```

Không có source Python, `pyproject.toml`, requirements hay test suite gốc. Binary là:

| Thuộc tính | Giá trị |
|---|---|
| Phiên bản CLI | `0.1.0` |
| Định dạng | ELF 64-bit, Linux x86-64 |
| Kích thước | `11,995,200` bytes |
| Cách đóng gói | PyInstaller, nhúng Python 3.13 |
| Trạng thái symbol | stripped |
| SHA-256 | `54727dcd116e18e09ee7ae0d53fdcdcf4a139d931b5ade5212ac9bf5c32678ae` |

Vì không có source, việc nghiên cứu được làm theo ba lớp:

1. Chạy `--help`, `--version` và toàn bộ subcommand.
2. Đọc metadata/bytecode nhúng để xác định endpoint, cấu hình, ignore rule và flow nội bộ.
3. Chạy binary với mock HTTP server cục bộ, ghi lại request, stdout, stderr, exit code và file output.

Không có credential hay project thật nào được gửi ra Internet trong các test này.

## 3. Toàn bộ command hiện có

```text
usage: secsource-cli [-h] [--version] {setup,login,status,scan,get,cancel} ...
```

| Command | Chức năng | Có gọi mạng? | Thành công thường exit |
|---|---|---:|---:|
| `setup` | Lưu server + token | Không | `0` |
| `login` | Xin access token rồi lưu config | Có | `0` |
| `status` | Gọi `/health` | Có | `0` |
| `scan` | Đóng gói/upload project, submit job | Có | `0` |
| `get` | Tải report của job đã hoàn tất | Có | `0` |
| `cancel` | Hủy/xóa job | Có | `0` |

Không truyền command là lỗi argparse:

```text
usage: secsource-cli [-h] [--version] {setup,login,status,scan,get,cancel} ...
secsource-cli: error: the following arguments are required: command
```

- Dòng trên đi vào `stderr`.
- Exit code là `2`.

## 4. Cấu hình và authentication

### 4.1 File cấu hình

Đường dẫn cố định:

```text
~/.config/secsource/client.toml
```

Nội dung:

```toml
server = "https://scanner.example.com"
token = "YOUR_TOKEN"
```

File được chmod `0600`, tức chỉ owner được đọc/ghi. Token vẫn là plaintext trong file; UI không được log hay đưa file này vào telemetry.

Hai environment variable được hỗ trợ và ưu tiên hơn file:

```text
SECSOURCE_SERVER
SECSOURCE_TOKEN
```

Binary không dùng `XDG_CONFIG_HOME`. Khi test/automation, cần nhớ `setup` và `login` luôn ghi vào home config ở trên.

### 4.2 Header gửi đến scanner API

Các request job dùng:

```http
Authorization: Bearer <token>
```

Riêng request `GET /health` của `status` **không gửi Authorization header** trong binary `0.1.0`. Vì vậy help ghi “reachability + auth” nhưng thực tế đây chủ yếu là health/reachability check.

## 5. `setup` — lưu server và token

### Input

```bash
./secsource-cli setup \
  --server https://scanner.example.com \
  --token YOUR_TOKEN
```

Hai option đều bắt buộc.

### Thành công

`stdout`:

```text
saved config to /home/USER/.config/secsource/client.toml
```

`stderr` rỗng, exit `0`.

Lệnh chỉ ghi config, không kiểm tra URL và không gọi server. Vì vậy output “saved” không chứng minh server/token hợp lệ.

### Thiếu argument

Ví dụ thiếu `--token`:

```text
usage: secsource-cli setup [-h] --server SERVER --token TOKEN
secsource-cli setup: error: the following arguments are required: --token
```

Output vào `stderr`, exit `2`.

## 6. `login` — xin token từ Authentik/OIDC endpoint

### Input

```bash
./secsource-cli login \
  --token-url https://auth.example.com/application/o/token/ \
  --client-id CLIENT_ID \
  --username USERNAME \
  --password PASSWORD \
  --scope api \
  --server https://scanner.example.com
```

`--scope` mặc định là `api`. `--server` không bắt buộc; nếu bỏ, CLI lấy server cũ trong config.

### HTTP request thực tế

CLI gửi form `application/x-www-form-urlencoded`:

```text
grant_type=client_credentials
client_id=CLIENT_ID
username=USERNAME
password=PASSWORD
scope=api
```

CLI lấy field `access_token` từ JSON response, rồi lưu token và server vào `client.toml`.

### Thành công

`stdout`:

```text
token obtained and saved to /home/USER/.config/secsource/client.toml
```

Exit `0`.

### Sai credential / HTTP 401

`stderr`:

```text
login failed: Client error '401 Unauthorized' for url 'https://auth.example.com/application/o/token/'
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
```

Exit `2`. Password/token không xuất hiện trong lỗi đã test.

## 7. `status` — kiểm tra `/health`

### Input và request

```bash
./secsource-cli status
```

```http
GET <server>/health
```

CLI bỏ dấu `/` cuối server trước khi nối endpoint. Request này không mang bearer token trong phiên bản hiện tại.

### Thành công

`stdout`:

```text
server: https://scanner.example.com
health: 200 {'status': 'ok'}
```

Exit `0`. Phần body là Python `dict` representation, không phải JSON chuẩn; chú ý dấu nháy đơn.

### Có server nhưng không có token

```text
server: https://scanner.example.com
health: 200 {'status': 'ok'}
warning: no token set (server may require one)
```

Vẫn exit `0` nếu health là `200`.

### Health trả HTTP 401

```text
server: https://scanner.example.com
health: 401 {'detail': 'invalid token'}
```

Output vẫn ở `stdout`, nhưng exit `2`.

### Chưa có server config

`stderr`:

```text
not configured — run `secsource-cli setup --server URL --token TOKEN`
```

Exit `2`.

### Server không kết nối được

`stderr`:

```text
server unreachable: [Errno 111] Connection refused
```

Exit `2`. Đây là command duy nhất trong nhóm scanner commands đã chuyển network exception thành lỗi gọn trong test.

## 8. `scan` — đóng gói và submit project

### 8.1 Cú pháp và default

```bash
./secsource-cli scan PATH \
  [--mode auto|deep|shallow] \
  [--format json|sarif] \
  [--wait] \
  [--force] \
  [-o OUTPUT]
```

Default quan sát được:

```text
mode   = auto
format = json
wait   = false
force  = false
```

### 8.2 PATH nào được chấp nhận?

CLI nhận:

- Một thư mục project; CLI tự tạo `.tar.gz` tạm.
- Archive có đuôi `.tar.gz`, `.tgz` hoặc `.zip`; CLI upload nguyên file đó.

File thường hoặc path không tồn tại bị từ chối:

```text
error: not a directory or archive file: /path/to/input
```

Output vào `stderr`, exit `2`.

### 8.3 CLI đưa file nào vào archive?

CLI áp dụng đồng thời:

1. Blacklist mặc định luôn bật.
2. `.git/info/exclude` của repo.
3. `.gitignore` ở root và các thư mục con, theo gitignore semantics.

Các nhóm bị blacklist đáng chú ý:

- VCS: `.git/`, `.hg/`, `.svn/`.
- Secret/config: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `.npmrc`, `.pypirc`, `.netrc`, credential/keystore/kubeconfig/tfvars/secret YAML.
- Dependency/build/cache: `node_modules/`, `.venv/`, `venv/`, `vendor/`, `target/`, `.gradle/`, `dist/`, `build/`, `out/`, `bin/`, `obj/`, `.cache/` và nhiều compiler artifacts.
- Local/database/log/temp: `*.db`, `*.log`, `*.tmp`, `*.bak`, `*.sql`, `*.dump`, `*.dmp`.
- **Toàn bộ `*.md` cũng bị bỏ qua.**
- Symlink bị bỏ qua.

Hệ quả: rule bảo vệ secret là hợp lý, nhưng `*.md` và `*.sql` có thể là input cần scan của một số project. Hiện CLI không có option để override blacklist mặc định.

Test fixture có `.gitignore`, `.env`, `README.md`, `keep.tmp`, `src/main.py`, `src/ignored.py`. Kết quả:

```text
packed 2 files -> tmpq11iu15g.tar.gz
```

Archive thực sự chỉ chứa:

```text
.gitignore
src/main.py
```

Nếu mọi file đều bị ignore:

```text
packed 0 files -> tmpkbxh7g9t.tar.gz
```

Sau đó `stderr`:

```text
error: nothing to upload (all files ignored?)
```

Exit `2`; archive tạm được xóa.

Giới hạn đã ghi trong code nhúng: negation `!` trong cùng một `.gitignore` hoạt động, nhưng `.gitignore` sâu hơn không thể re-include path đã bị `.gitignore` nông hơn loại.

### 8.4 HTTP request submit

CLI gửi:

```http
POST <server>/v1/jobs
Authorization: Bearer <token>
Content-Type: multipart/form-data
Idempotency-Key: <sha256-của-archive>   # trừ khi có --force
```

Multipart gồm:

```text
file   = archive, content type application/gzip
mode   = auto | deep | shallow
format = json | sarif
```

Server dự kiến trả HTTP `202` với JSON tối thiểu:

```json
{
  "key": "job-mock-001",
  "status": "pending"
}
```

CLI dùng field `key` làm `JOB_ID`.

### 8.5 Submit thành công, không chờ

Input:

```bash
./secsource-cli scan /path/to/project --mode deep --format json
```

`stdout`:

```text
packed 2 files -> tmpt1n8d56z.tar.gz
job job-mock-001 submitted
check status / download the report: secsource-cli get job-mock-001 -o report.json
```

Exit `0`.

Tên file `tmp...tar.gz`, số file và job ID thay đổi theo lần chạy. Nếu cần parse `JOB_ID`, regex tối thiểu là:

```regex
^job (\S+) submitted$
```

Không lấy job ID từ dòng `check status...`, vì đó chỉ là hướng dẫn cho người dùng.

### 8.6 `--force` và idempotency

Không có `--force`, header `Idempotency-Key` đúng bằng SHA-256 của bytes archive. Có `--force`, header này bị bỏ hoàn toàn.

Test cũng cho thấy archive tạm tạo từ cùng một folder có SHA-256 khác nhau giữa các lần chạy, do metadata gzip/tar thay đổi. Vì vậy dedup hiện đáng tin hơn khi upload một archive có sẵn; với directory scan, không nên giả định hai lần chạy sẽ có cùng idempotency key.

### 8.7 `-o` khi không có `--wait`

```bash
./secsource-cli scan PROJECT -o report.json
```

Lệnh vẫn chỉ submit job, exit `0`, và **không tạo `report.json`**. Option `-o` bị bỏ qua âm thầm nếu thiếu `--wait`.

### 8.8 `scan --wait -o report.json`

```bash
./secsource-cli scan /path/to/project \
  --mode deep \
  --format json \
  --wait \
  -o report.json
```

CLI submit xong sẽ gọi:

```http
GET <server>/v1/jobs/<JOB_ID>/wait
```

Endpoint này long-poll đến terminal state. CLI không đặt deadline tổng cho scan; lỗi transport trên `/wait` được retry sau một khoảng nghỉ.

Khi job hoàn tất, CLI gọi:

```http
GET <server>/v1/jobs/<JOB_ID>/result
```

`stdout`:

```text
packed 2 files -> tmp347x920m.tar.gz
job job-mock-001 submitted
check status / download the report: secsource-cli get job-mock-001 -o report.json
report written to report.json
```

Exit `0`. File chứa nguyên bytes response body; CLI không tự validate JSON/SARIF.

Nếu terminal state là `failed`:

- Các dòng `packed`, `job ... submitted` vẫn ở `stdout`.
- `stderr`: `job job-failed ended with status failed`
- Exit `2`.
- Không có report output.

### 8.9 `scan --wait` không có `-o`

Output là log rồi nối report raw:

```text
packed 2 files -> tmpoz96bc7l.tar.gz
job job-mock-001 submitted
check status / download the report: secsource-cli get job-mock-001 -o report.json
{"metadata":{...},"findings":[],...}
```

Toàn stdout **không phải JSON hợp lệ**. UI nên luôn truyền `-o` nếu dùng `scan --wait`.

### 8.10 Submit bị HTTP 401

`stdout` vẫn có:

```text
packed 2 files -> tmpqvwxo64p.tar.gz
```

`stderr`:

```text
submit failed: 401 {"detail":"invalid token"}
```

Exit `2`.

## 9. `get` — tải report

### Request

```http
GET <server>/v1/jobs/<JOB_ID>/result
Authorization: Bearer <token>
```

CLI không gọi `/v1/jobs/<JOB_ID>` trước. Nó kỳ vọng server tự từ chối nếu job chưa hoàn tất.

### 9.1 Report ra stdout

```bash
./secsource-cli get JOB_ID
```

`stdout` là nguyên response body:

```json
{"metadata":{"scan_id":"..."},"findings":[],"investigated_findings":[],"degraded":false}
```

Không có newline ở cuối. Exit `0`.

Đây là command duy nhất có thể lấy JSON sạch trực tiếp từ stdout, miễn là server trả report hợp lệ.

### 9.2 Report ra file

```bash
./secsource-cli get JOB_ID -o report.json
```

`stdout`:

```text
report written to report.json
```

File `report.json` chứa nguyên bytes body; exit `0`.

CLI không tạo parent directory. Nếu parent chưa tồn tại, phiên bản `0.1.0` văng `FileNotFoundError` traceback và exit `1`.

### 9.3 Job không tồn tại

`stderr`:

```text
get failed: 404 {"detail":"job not found"}
```

Exit `2`, không tạo output file.

### 9.4 Job chưa hoàn tất

Một response `409` được in như sau:

```text
get failed: 409 {"detail":"job not completed"}
```

Exit `2`, không tạo output file. UI có thể coi đây là trạng thái “chưa sẵn sàng” và retry với backoff, nhưng phải phân biệt với các lỗi `4xx` khác.

## 10. `cancel` — hủy/xóa job

### Request

```http
DELETE <server>/v1/jobs/<JOB_ID>
Authorization: Bearer <token>
```

### Thành công

```bash
./secsource-cli cancel job-mock-001
```

`stdout`:

```text
{'status': 'cancelled', 'job_id': 'job-mock-001'}
```

Exit `0`. Đây là Python dict representation, **không phải JSON chuẩn**.

### Job không tồn tại

`stderr`:

```text
cancel failed: 404 {"detail":"job not found"}
```

Exit `2`.

## 11. Error model và exit code

| Tình huống | stdout | stderr | Exit |
|---|---|---|---:|
| Thành công | Dữ liệu/thông báo | rỗng | `0` |
| Argparse sai/thiếu option | rỗng | usage + error | `2` |
| Chưa config | rỗng | lỗi gọn | `2` |
| HTTP error đã xử lý | có thể có log trước đó | `... failed: STATUS BODY` | `2` |
| Job wait kết thúc `failed/cancelled` | log submit | terminal status | `2` |
| Network error của `status` | rỗng | lỗi gọn | `2` |
| Network error của `scan/get/cancel` | có thể có log pack | Python traceback + PyInstaller error | `1` |
| Không ghi được output file | rỗng | Python traceback | `1` |

UI không nên dựa duy nhất vào text. Luôn kiểm tra exit code, giữ stdout và stderr tách riêng, và sanitize mọi log có thể chứa path nội bộ.

## 12. Contract API suy ra từ binary

| Method | Endpoint | CLI sử dụng ở đâu |
|---|---|---|
| `GET` | `/health` | `status` |
| `POST` | `/v1/jobs` | `scan` |
| `GET` | `/v1/jobs/{key}` | Có client method nội bộ nhưng chưa có CLI command |
| `GET` | `/v1/jobs/{key}/wait` | `scan --wait` |
| `GET` | `/v1/jobs/{key}/result` | `get`, hoặc sau `scan --wait` |
| `DELETE` | `/v1/jobs/{key}` | `cancel` |

Binary không expose endpoint liệt kê toàn bộ job. Dòng `// list all job — DOING` trong `command.txt` cũ đúng với trạng thái hiện tại: chưa có command đó.

## 13. Report JSON dành cho dashboard

### 13.1 Top-level

Ba report thật đều có đúng bốn field top-level:

```json
{
  "metadata": {},
  "findings": [],
  "investigated_findings": [],
  "degraded": false
}
```

Ý nghĩa:

- `metadata`: định danh, mode, thời gian và phiên bản scanner.
- `findings`: danh sách finding gốc từ Trivy/OpenGrep.
- `investigated_findings`: kết quả deep investigation, liên kết lại finding gốc bằng ID.
- `degraded`: scan có hoàn tất trong trạng thái suy giảm hay không.

### 13.2 Metadata

```json
{
  "scan_id": "d37d71d45fe14f88af937ba1210c1d4a",
  "mode": "deep",
  "started_at": "2026-08-17T09:28:18.561678Z",
  "finished_at": "2026-08-17T11:22:46.598779Z",
  "tool_versions": {
    "opengrep": "1.25.0",
    "trivy": "0.71.2"
  },
  "degraded_reasons": []
}
```

`scan_id` trong report là ID bền vững để UI định danh report. Không nên giả định nó luôn giống `JOB_ID`, dù mock test dùng cùng giá trị.

### 13.3 Một `finding`

Các key quan sát được:

```text
id, tool, category, rule_id, message, severity, confidence,
locations, fix, raw, dependency, deep_investigable,
reachability, paths
```

Hai nhóm chính trong report mẫu:

- `tool = trivy`, `category = dependency`: lỗ hổng dependency/CVE; thường có `dependency` và `paths`.
- `tool = opengrep`, `category = sast`: finding source code; thường không có dependency path.

Các giá trị có thể là `null`; UI phải xử lý `snippet`, `fix`, `dependency`, `reachability`, line range và symbol như nullable.

### 13.4 `investigated_findings`

Mỗi item có:

```json
{
  "shallow_finding": {
    "id": "SAME_ID_AS_FINDING"
  },
  "exploitability": {
    "verdict": "exploit | not_exploitable | unknown",
    "confidence": "high | medium | low",
    "reasoning": "...",
    "evidence_refs": ["file:line"],
    "evidence_chain": [
      {
        "file": "src/example.ts",
        "line": 17,
        "role": "caller",
        "note": "...",
        "verified": true
      }
    ],
    "clamped_reason": null
  }
}
```

Join đúng cách:

```text
findings[i].id
    = investigated_findings[j].shallow_finding.id
```

Không join bằng `rule_id`: nhiều finding có thể dùng cùng rule/CVE ở location khác nhau.

### 13.5 Thống kê ba report mẫu

| File | Size | Thời gian scan | Findings | Investigated | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `jobcv_backend.json` | 483,403 B | 1h 10m 46.920s | 56 | 53 | 1 | 25 | 27 | 3 |
| `jobcv_frontend.json` | 783,429 B | 1h 54m 28.037s | 84 | 82 | 0 | 29 | 53 | 2 |
| `teacherAI_frontend.json` | 126,190 B | 19m 27.752s | 13 | 13 | 0 | 7 | 6 | 0 |
| **Tổng** | 1,393,022 B | — | **153** | **148** | **1** | **61** | **86** | **5** |

Phân bố tool/category:

| Report | Trivy/dependency | OpenGrep/SAST |
|---|---:|---:|
| JobCV Backend | 46 | 10 |
| JobCV Frontend | 62 | 22 |
| TeacherAI Frontend | 13 | 0 |

Deep verdict trong dữ liệu mẫu:

| Report | Exploit | Not exploitable | Unknown |
|---|---:|---:|---:|
| JobCV Backend | 11 | 7 | 35 |
| JobCV Frontend | 16 | 5 | 61 |
| TeacherAI Frontend | 0 | 0 | 13 |

Năm finding không có investigation đều có `deep_investigable = false`; đây không phải lỗi join của UI.

## 14. `normalizeReport(...)` và trạng thái tích hợp web

Report raw cần truyền vào:

```ts
normalizeReport(rawJson, projectName, projectSlug)
```

Hàm hiện tại:

- Normalize severity/confidence/mode về union type của UI.
- Join investigation bằng `shallow_finding.id`.
- Tạo evidence graph từ `evidence_chain`.
- Nếu không có investigation, fallback sang usage sites trong `paths`.
- Đếm severity cho dashboard.
- Có safe defaults nếu report malformed.

Đã kiểm tra:

```text
Test Files  7 passed (7)
Tests      20 passed (20)
```

Production typecheck + Vite build cũng thành công. Aggregate test xác nhận đúng `153` findings.

Tuy nhiên `web/src/services/client.ts` hiện là:

```ts
export const secSourceClient: SecSourceClient = new MockSecSourceClient()
```

Nghĩa là màn hình hiện tại chỉ mô phỏng lifecycle và đọc ba fixture JSON; nó chưa invoke `./secsource-cli`, chưa gọi scanner API thật và chưa đọc config thật.

## 15. Luồng đề xuất cho UI thật

### Phương án CLI bridge

Browser thuần không thể chạy binary hay đọc arbitrary local path. Cần một lớp desktop main process/local backend có API kiểu:

```text
UI → bridge.createScan(input) → spawn secsource-cli scan ...
UI ← { jobId, stdout, stderr, exitCode }

UI → bridge.downloadReport(jobId, outputPath)
   → spawn secsource-cli get JOB_ID -o OUTPUT
UI ← đọc + JSON.parse(file) → normalizeReport(...)
```

Quy tắc triển khai:

1. Spawn process bằng argument array, không ghép shell string.
2. Capture `stdout` và `stderr` riêng.
3. Chỉ nhận `JOB_ID` nếu process exit `0` và có dòng `^job (\S+) submitted$`.
4. Tạo parent directory trước khi truyền `-o`.
5. Dùng output file riêng cho từng job; không dùng chung `report.json` nếu có scan song song.
6. Kiểm tra exit code trước khi đọc file.
7. `JSON.parse` file rồi mới gọi `normalizeReport(...)`.
8. Không log password, token, Authorization header hay nội dung config.

### Luồng tối thiểu

```bash
./secsource-cli scan /path/to/project --mode deep --format json
# parse JOB_ID từ dòng: job <JOB_ID> submitted

./secsource-cli get <JOB_ID> -o /safe/existing/dir/<JOB_ID>.json
# nếu 409: job chưa xong, retry có backoff
# nếu exit 0: đọc file và normalize
```

Với UX có progress/list job, nên gọi scanner API trực tiếp hoặc bổ sung command `list/job-status`; CLI `0.1.0` chưa cung cấp đủ primitive đó.

## 16. Các vấn đề nên ưu tiên sửa trong CLI

| Mức | Vấn đề | Ảnh hưởng |
|---|---|---|
| Cao | `scan/get/cancel` không bắt network exception | UI nhận traceback + exit `1`, khó hiển thị lỗi sạch |
| Cao | Chưa có `list` và job-status command | Dashboard không thể refresh danh sách/progress qua CLI |
| Cao | Directory archive không deterministic | Idempotency/dedup mặc định không ổn định |
| Trung bình | `status` không gửi bearer token | Không thật sự kiểm tra auth như help mô tả |
| Trung bình | `scan --wait` không `-o` trộn log và report | Không thể parse toàn stdout thành JSON |
| Trung bình | `-o` không tạo parent directory | Văng traceback nếu folder chưa tồn tại |
| Trung bình | `-o` bị bỏ qua nếu thiếu `--wait` | Dễ khiến UI tưởng đã có file |
| Trung bình | `cancel` và `status` in Python dict | Không phải machine-readable JSON chuẩn |
| Trung bình | Blacklist luôn loại `*.md`, `*.sql` | Có thể bỏ sót input cần security scan |
| Thấp | Chỉ có binary Linux x86-64 | Cần build riêng cho macOS/Windows/ARM64 |

Đề xuất output machine-readable lâu dài:

```bash
secsource-cli scan ... --output-mode json
```

```json
{"ok":true,"job_id":"...","status":"submitted"}
```

Và mọi lỗi cũng theo cùng schema, kèm exit code ổn định. Khi đó UI không phải parse câu tiếng Anh.

## 17. Ma trận test đã chạy

| Case | Kết quả |
|---|---|
| `--help`, `--version`, help từng command | Pass |
| Không command / command lạ / enum sai | Exit `2`, argparse error đúng |
| Setup thành công, kiểm tra nội dung + mode file | Pass, mode `0600` |
| Login thành công và HTTP 401 | Pass |
| Status chưa config / 200 / 401 / offline / thiếu token | Đã ghi nhận đầy đủ |
| Scan folder, ignore rules, all-ignored | Pass |
| Scan archive `.tar.gz` có sẵn | Pass |
| Mode `auto/deep/shallow`, format `json/sarif` | Request đúng |
| `--force` | Bỏ `Idempotency-Key` đúng |
| Submit success / HTTP 401 / connection refused | Đã ghi nhận |
| `--wait` completed / failed; có và không `-o` | Đã ghi nhận |
| Get stdout / file / 404 / 409 / offline / parent thiếu | Đã ghi nhận |
| Cancel success / 404 / offline | Đã ghi nhận |
| Validate ba report JSON | Cả 3 hợp lệ |
| Unit test dashboard | 20/20 pass |
| Typecheck + production build | Pass; Vite cảnh báo chunk lớn nhưng không fail |

Mock server dùng để tái hiện test nằm tại `tests/mock_server.py`; fixture đóng gói nằm tại `tests/fixture/` và `tests/all_ignored/`.

Chạy lại smoke test mà không ghi config thật:

```bash
# Terminal 1, chạy từ thư mục secsource-cli/
SECSOURCE_MOCK_LOG=/tmp/secsource-mock.jsonl \
  python3 tests/mock_server.py

# Terminal 2
SECSOURCE_SERVER=http://127.0.0.1:18991 \
SECSOURCE_TOKEN=TEST_TOKEN \
  ./secsource-cli scan tests/fixture --mode deep --format json --wait \
  -o /tmp/secsource-report.json

jq . /tmp/secsource-report.json
```

Mock log tự che giá trị bearer token và password. Không dùng `setup`/`login` trong smoke test này, nên `~/.config/secsource/client.toml` không bị thay đổi.
