# CLAUDE.md - Team Draw (PES 2021 Team Picker)

## Tổng quan
Web app cá nhân để bốc ngẫu nhiên đội bóng cho trận 1 vs 1 giữa đúng 2 người chơi PES 2021 (bản mod, đội hình và tên đội cập nhật mùa hiện tại) theo kiểu local multiplayer. Mọi người cầm điện thoại, bấm bốc, xem màn reveal 3D hologram (Holographic Stadium, 3D Team Cards, VS Clash), rồi vào game chọn đúng đội đã bốc.

- Phạm vi: CHỈ bốc đội cho ĐÚNG 2 người chơi. Không có tuỳ chọn số người chơi. Không làm giải đấu, tỉ số, bảng xếp hạng.
- Thiết bị chính: điện thoại (mobile-first). Desktop chỉ cần hiển thị ổn.
- Ngôn ngữ UI: tiếng Anh. Code, tên biến, commit: tiếng Anh. Riêng README.md và DATA_REPORT.md viết tiếng Việt.
- Tên đội giữ đúng dấu (Curaçao, Türkiye, Côte d'Ivoire, Atlético Madrid), font phải hiển thị được các ký tự này.
- Không có âm thanh, không rung.
- Dùng cá nhân: được dùng cờ, logo CLB, ảnh lấy từ internet.

## Ràng buộc kỹ thuật
- Output: 1 file duy nhất `dist/index.html`, chạy offline khi mở trực tiếp (file://) và khi host trên Cloudflare Pages. Không gọi network lúc runtime.
  - Ngoại lệ PWA (cài thành app trên mobile): build sinh thêm `manifest.webmanifest`, `sw.js`, `icons/*.png`, `_headers` cạnh `index.html`. Các file này chỉ dùng khi chạy qua https; `index.html` vẫn phải tự chạy được một mình qua file:// và không request file PWA nào khi mở từ file://.
- Source chia module trong `src/`. Build bằng Node + esbuild, inline toàn bộ JS, CSS, data JSON, ảnh (data URI) vào `dist/index.html`.
- Vanilla JS (ES modules). Không React, không framework UI. Three.js pin version cụ thể, tree-shake, inline.
- Ngân sách: `dist/index.html` <= 3 MB. Cảnh 3D >= 50 fps trên Android tầm trung (vd Galaxy A54). Tương tác được < 3s trên 4G.
- Hosting: Cloudflare Pages (`wrangler pages deploy dist`), gắn subdomain của tuhoang.app (DNS đã nằm trên Cloudflare).

## Cấu trúc thư mục (đề xuất, được điều chỉnh nếu có lý do)
```
src/
  main.js            # khởi tạo app, router giữa các màn
  config.js          # ngưỡng sao, thời lượng animation, cờ tính năng
  state.js           # state + persist localStorage
  draw/              # logic bốc thuần (không đụng DOM), có test
  ui/                # màn Thiết lập, Kết quả, Lịch sử, fallback 2D
  scene/             # Three.js: stadium hologram, card, VS clash, hạt, tween, quality tier
  data/
    teams.json       # danh sách đội (nguồn sự thật)
    ratings.json     # rating đã thu thập + nguồn
    overrides.json   # rating/sao chỉnh tay, ưu tiên cao nhất
  assets/
    flags/           # SVG cờ đã tối ưu
    logos/           # logo CLB đã tối ưu
scripts/
  build.mjs          # bundle + inline ra dist/index.html
  fetch-ratings.mjs  # thu thập rating
  fetch-assets.mjs   # tải cờ, logo
  import-csv.mjs     # nhập rating tay từ CSV
test/                # node --test
DATA_REPORT.md       # báo cáo data sau mỗi lần cập nhật
ASSET_SOURCES.md     # URL nguồn của từng logo
```

## Danh sách đội (cố định, không thêm bớt trừ khi được yêu cầu)

### Đội tuyển quốc gia (48, World Cup 2026)
- Bắc Mỹ: Canada, Mexico, United States, Panama, Haiti, Curaçao
- Nam Mỹ: Argentina, Brazil, Ecuador, Uruguay, Colombia, Paraguay
- Châu Phi: Morocco, Tunisia, Egypt, Algeria, Ghana, Cape Verde, South Africa, Côte d'Ivoire, Senegal, DR Congo
- Châu Á: Japan, Iran, Uzbekistan, South Korea, Jordan, Australia, Qatar, Saudi Arabia, Iraq
- Châu Đại Dương: New Zealand
- Châu Âu: England, France, Croatia, Portugal, Norway, Germany, Netherlands, Belgium, Spain, Switzerland, Austria, Scotland, Bosnia and Herzegovina, Czechia, Sweden, Türkiye

### CLB (37)
- Top 5 Premier League: Arsenal, Manchester City, Manchester United, Aston Villa, Liverpool
- Top 5 La Liga: Barcelona, Real Madrid, Villarreal, Atlético Madrid, Real Betis
- Top 5 Ligue 1: Paris Saint-Germain, Lens, Lille, Lyon, Marseille
- Top 5 Bundesliga: Bayern Munich, Borussia Dortmund, RB Leipzig, VfB Stuttgart, Hoffenheim
- Top 5 Serie A: Inter, Napoli, Roma, Como, AC Milan
- Champions League knockout: Tottenham Hotspur, Chelsea, Sporting CP, Newcastle United, Juventus, Atalanta, Bayer Leverkusen, Olympiacos, Club Brugge, Galatasaray, Monaco, Benfica

Lưu ý: Monaco là quốc gia Monaco nhưng đá Ligue 1. Lưu `country: "Monaco"`, `league: "Ligue 1"`.

### Schema `teams.json`
```json
{
  "id": "arsenal",
  "name": "Arsenal",
  "sourceAliases": { "fifaindex": "Arsenal", "elo": null },
  "shortName": "ARS",
  "type": "club",
  "region": null,
  "country": "England",
  "league": "Premier League",
  "groups": ["Premier League top 5"],
  "flagIso": "gb-eng",
  "logo": "logos/arsenal.svg",
  "colors": ["#EF0107", "#FFFFFF"]
}
```
- `type`: "national" | "club". Đội tuyển có `region` (châu lục), CLB có `country` + `league`.
- `flagIso`: mã của package flag-icons. Đội tuyển dùng làm hình chính, CLB dùng làm badge quốc gia nhỏ.
- `colors`: màu áo chính/phụ, dùng cho bóng, card, badge dự phòng.
- `sourceAliases`: tên đội trên từng nguồn rating khi khác `name` (vd fifaindex dùng "Congo DR", "Austria (National team)", "Bayern München", "Atlético de Madrid"; eloratings dùng "Ivory Coast"). Match theo alias, không match mờ.

## Rating và cân bằng

### Nguồn rating (theo thứ tự ưu tiên)
Không dùng sofifa: đã test ngày 2026-11-18, trang trả về 403 kèm Cloudflare challenge, kể cả khi mở trong trình duyệt thật.

1. `overrides.json`: số tao nhập tay (lấy từ data của mod trong game). Luôn thắng.
2. fifaindex.com, bản FC 27 (mặc định, cấu hình được sang FC 26): team OVR / ATK / MID / DEF.
   - CLB: https://fifaindex.com/teams (có phân trang, có ô search `?q=`). Đã xác nhận có Como và Olympiacos.
   - Đội tuyển: https://fifaindex.com/teams?category=men (51 đội, 2 trang).
   - Đây là proxy vì thang EA FC khác engine PES, chỉ dùng để xếp sao.
   - Đã test: mở bằng trình duyệt thật thì đọc được, nhưng fetch server-side bị từ chối. Vì vậy `fetch-ratings.mjs` dùng Playwright Chromium để đọc trang, KHÔNG dùng fetch/axios trần. Nếu headless vẫn bị chặn thì chạy headed (`--headed`). Giới hạn 1 request mỗi 2s, cache HTML vào `.cache/` để không tải lại.
3. eloratings.net (World Football Elo), chỉ dùng cho đội tuyển mà fifaindex không có. Data lấy từ `https://eloratings.net/World.tsv` (cột 3 là mã đội, cột 4 là điểm Elo) kết hợp `https://eloratings.net/en.teams.tsv` để ra tên. Dùng đúng origin `eloratings.net`, không có `www`, vì bản `www` bị CORS khi fetch trong trang.
   - Quy đổi Elo sang thang OVR: hồi quy tuyến tính trên các tuyển có cả 2 nguồn (khoảng 31 đội), áp dụng cho các tuyển còn thiếu. Ghi hệ số, R² và danh sách đội dùng để hồi quy vào DATA_REPORT.md.
   - Đội quy đổi từ Elo: `att/mid/def = null`, `source: "elo-mapped"`.
4. Không có ở nguồn nào: `ovr: null`, `stars: null`, liệt kê trong DATA_REPORT.md. TUYỆT ĐỐI không đoán rating từ trí nhớ.

Độ phủ đã kiểm tra trên fifaindex FC 27 (2026-11-18):
- Đội tuyển CÓ (31): Mexico, United States, Argentina, Brazil, Uruguay, Colombia, Paraguay, Morocco, Egypt, Ghana, DR Congo, Japan, Australia, Qatar, Saudi Arabia, New Zealand, England, France, Croatia, Portugal, Norway, Germany, Netherlands, Belgium, Spain, Switzerland, Austria, Scotland, Czechia, Sweden, Türkiye.
- Đội tuyển KHÔNG CÓ, phải dùng Elo (17): Canada, Panama, Haiti, Curaçao, Ecuador, Tunisia, Algeria, Cape Verde, South Africa, Côte d'Ivoire, Senegal, Iran, Uzbekistan, South Korea, Jordan, Iraq, Bosnia and Herzegovina. Cả 17 đội đều có trên eloratings.
- CLB: chưa kiểm tra đủ 37 đội, script phải xác nhận từng đội và báo đội thiếu.

`ratings.json` lưu cho mỗi đội: `ovr, att, mid, def, source ("fifaindex-fc27" | "elo-mapped" | "override"), sourceUrl, fetchedAt`.
Nếu cả Playwright cũng bị chặn: dừng, báo lại, xuất `ratings_template.csv` (id, name, ovr, att, mid, def) để nhập tay, dùng `scripts/import-csv.mjs` nạp vào.

### Sao
- Map OVR sang 1 đến 5 sao, bước 0.5. Ngưỡng nằm trong `config.js`.
- Mặc định tính ngưỡng theo quantile trên toàn bộ đội có rating, sau đó tao chỉnh tay.
- Overrides có thể đặt thẳng `stars` mà không cần OVR.
- Hiển thị sao trong một mode luôn dùng cùng một thang, gồm cả mode Mixed (club và tuyển chung thang).
- Đội có `source: "elo-mapped"` hiện dấu nhỏ "est." cạnh OVR để biết đây là số ước lượng.

### Chế độ cân bằng (label UI tiếng Anh)
- "Free": random thuần.
- "Same tier": chọn ngẫu nhiên một mức sao có ít nhất 2 đội (trọng số theo số đội trong mức), cả hai bên bốc trong mức đó.
- "Max gap N★" (N = 0.5 / 1 / 1.5): bốc đội thứ nhất, đội thứ hai nằm trong ±N quanh đội thứ nhất. Không đủ đội thì nới khoảng và hiện thông báo.
- Mặc định: "Max gap 1★".
- Đội có `stars: null` chỉ xuất hiện ở chế độ "Free".

## Tính năng
- 3 mode pool: "National", "Clubs", "Mixed". Hiện số đội trong pool.
- Luôn có đúng 2 người chơi. Tên tuỳ chọn, mặc định "Player 1" và "Player 2". Có nút đổi bên (swap) hai đội đã bốc.
- Toggle "Allow mirror match" (mặc định tắt): bật thì hai người có thể bốc trùng đội.
- Khoá đội của từng bên. Redraw chỉ bốc lại bên chưa khoá (vd giữ Brazil cho Player 1, bốc lại đối thủ). Khoá cả hai bên thì nút Redraw bị vô hiệu. Đổi mode thì xoá khoá.
- Khi một bên bị khoá, chế độ cân bằng tính theo đội đã khoá.
- Không tìm được đội thoả điều kiện (vd tier quá ít đội): báo lỗi rõ, không âm thầm bỏ điều kiện.
- Sau khi bốc, hiện chênh lệch OVR giữa hai đội (vd "Gap: 3 OVR").
- Lịch sử 20 lượt gần nhất (giờ, mode, chế độ cân bằng, "Team A vs Team B"). Có nút xoá.
- Copy kết quả, định dạng: `Nam (Brazil ★4.5 · OVR 84) vs Minh (France ★5 · OVR 86)`. Có Web Share API nếu trình duyệt hỗ trợ.
- RNG: `crypto.getRandomValues` + Fisher-Yates.
- Persist localStorage (bọc try/catch, lỗi thì chạy bằng state trong bộ nhớ): mode, tên 2 người, toggle, chế độ cân bằng, lịch sử.

## Màn bốc 3D: Holographic Stadium + VS Clash + 3D Team Cards
Mục tiêu: lần đầu xem phải thấy "wow", nhưng chạy mượt trên mobile tầm trung. Khi phải đánh đổi giữa hai thứ này thì độ mượt thắng. Một hiệu ứng làm tụt khung hình là hiệu ứng hỏng.

### Ngôn ngữ hình ảnh
- Hologram công nghệ cao trên nền tối: cạnh fresnel phát sáng, scanline chạy dọc, nhiễu nhẹ (glitch) khi xuất hiện, hạt sáng trôi lơ lửng.
- Palette: nền #07130f. Hologram pha giữa neon xanh lá #78ff9a và cyan #5cf2ff, accent #c8ff53. Màu theo tier: vàng (#ffd76a) cho 5★, bạc ánh cầu vồng cho 4★, đồng cho 3★, xanh lạnh cho tier thấp hơn.
- Màu áo của đội (`colors`) tô viền và vệt sáng trên card của đội đó, để mỗi đội có màu riêng.

### 1. Holographic Stadium (cảnh nền, chạy suốt màn Draw)
- Đế chiếu hologram hình tròn ở giữa: vài vòng emissive xoay ngược chiều nhau, cột sáng (beam) hình nón chiếu lên.
- Sân vận động low-poly dạng khung dây (wireframe/edges) lơ lửng phía trên đế. Gồm mặt sân có vạch sân phát sáng và khán đài hình bát. Xoay chậm. Shader hologram: fresnel + scanline + alpha flicker, additive blending, không cần ánh sáng.
- Boot-up khi vào màn (<= 0.8s): sân dựng lên từ dưới lên bằng clip-plane hoặc dissolve theo trục Y, kèm glitch ngắn.
- Hạt sáng dạng GPU points (một draw call), số lượng theo tier chất lượng.
- Camera: đưa vào chậm (dolly) lúc boot, sau đó lơ lửng nhẹ (idle sway). Không có cú cắt cảnh đột ngột.

### 2. 3D Team Cards (lật bài cho từng bên)
- Card là mesh chữ nhật bo góc có độ dày mỏng. Mặt trước vẽ bằng CanvasTexture 512x768, dựng sẵn trước khi animation chạy: logo/cờ, tên đội, sao, OVR (có nhãn "est." nếu là `elo-mapped`), ATT/MID/DEF, tên người chơi. Mặt sau là hoa văn hologram dùng chung cho mọi card.
- Shader foil holographic: dải màu ánh cầu vồng đổi theo góc nhìn và độ nghiêng của card. Cường độ foil tăng theo tier: 5★ ánh vàng mạnh kèm vệt sáng quét ngang (shine sweep), tier thấp chỉ có ánh nhẹ.
- Chuỗi xuất hiện cho mỗi bên (Player 1 trước, Player 2 sau), mỗi bên <= 2s:
  1. Beam trên đế sáng lên, card hiện dần từ dưới lên (scan-in dissolve) trong lúc đang úp mặt sau.
  2. Card xoay 1.5 vòng rồi dừng ở mặt trước (ease-out có overshoot nhẹ).
  3. Với đội 5★: flash vàng, một vòng sóng sáng lan trên mặt sân, burst hạt.
  4. Card thu nhỏ và trượt về nửa màn hình của bên đó (Player 1 bên trái, Player 2 bên phải, hai card đứng cạnh nhau kể cả trên màn hình dọc, để cột trái/phải của thanh so sánh khớp với card).
- Tương tác với card: kéo một ngón để nghiêng card, foil đổi màu theo góc nghiêng. Con quay hồi chuyển (gyroscope) chỉ là tuỳ chọn có nút bật, vì iOS bắt xin quyền. Mặc định dùng thao tác kéo.

### 3. VS Clash (cao trào, chạy một lần sau khi lật xong 2 card)
- Chuỗi clash, tổng <= 1.8s:
  1. Hai card lao vào từ hai bên, nghiêng về phía nhau, có vệt chuyển động (motion trail) bằng ribbon mesh hoặc stretched sprite.
  2. Va chạm ở giữa: flash trắng 1 frame, sóng xung kích (vòng shockwave mở rộng dần), rung camera (screen shake) <= 150ms, burst hạt.
  3. Chữ "VS" lớn bật ra ở giữa (plane dùng texture có sẵn, không dùng TextGeometry), có glitch chromatic.
  4. Hai card tách ra hai bên. Thanh so sánh ATT / MID / DEF / OVR chạy từ tâm ra hai phía, bên nào cao hơn sáng hơn. Thiếu chỉ số (đội elo-mapped) thì chỉ so OVR.
  5. Hiện dòng chênh lệch (vd "Gap: 2 OVR").
- Tổng thời gian màn Draw: boot + 2 card + clash <= 6s. Thời lượng từng bước cấu hình được trong `config.js`.
- Redraw khi một bên bị khoá: card bên khoá giữ nguyên, chỉ bên kia chạy lại chuỗi reveal, rồi clash lại.

### Điều khiển
- Chạm màn hình: tua nhanh bước hiện tại (x3 tốc độ). Nút "Skip": nhảy thẳng tới màn kết quả. Nút "Redraw".
- Màn cuối: hai card cạnh nhau (P1 trái, P2 phải); ngay dưới là hàng [Lock P1] [VS] [Lock P2], rồi thanh so sánh và dòng Gap. Không lặp lại thông tin đội ở panel DOM riêng (card 3D đã có đủ). Nền 3D vẫn chuyển động nhẹ (~30 fps). Chạm vào một card để phóng to và nghiêng xem foil.

### Ngân sách hiệu năng (bắt buộc)
- Mục tiêu: 60 fps trên máy cao cấp, >= 50 fps trên Android tầm trung (vd Galaxy A54), p95 frame time <= 20ms. Không frame nào > 50ms trong suốt chuỗi animation.
- Draw call <= 60, triangles <= 150k, texture tối đa 1024px, tổng bộ nhớ texture <= 48MB.
- Không dùng real-time light, không shadow. Mọi material là unlit (ShaderMaterial/MeshBasicMaterial). Dùng chung material và geometry tối đa có thể. Hạt và vòng sáng gom bằng Points/InstancedMesh.
- Glow: dùng sprite glow additive và màu emissive trong shader thay cho bloom. Bloom hoặc chromatic aberration toàn màn hình chỉ bật ở tier "high", render ở nửa độ phân giải.
- Chống giật (jank): gọi `renderer.compile()` và dựng sẵn mọi CanvasTexture trước khi chạy timeline, không tạo object hay material mới trong lúc animation chạy, tái sử dụng object (pooling) cho card và hạt.
- Timeline dựa trên delta time, không phụ thuộc frame. Tự viết module tween nhỏ (easing + timeline), không thêm dependency.
- Tier chất lượng high / medium / low: chọn ban đầu theo `devicePixelRatio`, `navigator.hardwareConcurrency` và benchmark ~1s lúc boot. Khi chạy, nếu fps < 45 liên tục 1.5s thì hạ tier (giảm DPR từ 2 về 1.5 rồi 1, giảm số hạt, tắt post-process). Tier ghi vào localStorage cho lần sau.
- Chỉ render khi có animation hoặc tương tác. Dừng loop khi tab ẩn. Xử lý `webglcontextlost` / `restored`.
- Khởi tạo Three.js sau khi UI 2D đã hiện.
- Không có WebGL hoặc có `prefers-reduced-motion`: fallback 2D bằng CSS 3D (card lật, VS slide-in, thanh so sánh), logic bốc giữ nguyên. Thêm toggle "Reduce effects" trong Setup để ép dùng tier low hoặc fallback.

### Đo và kiểm chứng
- Thêm HUD debug bật bằng `?debug=1`: hiện fps, frame time, draw calls, triangles, tier hiện tại.
- Cuối Phase 4: dùng Playwright + CDP, viewport 390x844, CPU throttle 4x, ghi lại chuỗi Draw đầy đủ và chuỗi Redraw một bên. Báo fps trung bình, p95 frame time, frame dài nhất. Kèm screenshot ở các khoảnh khắc: boot, card reveal, clash, kết quả.
- Phải test trên thiết bị thật (Android) qua LAN trước khi coi Phase 4 là xong. Ghi kết quả vào DATA_REPORT.md mục "Performance".

## UI/UX
- Mobile-first, viewport 360 đến 430px. Tôn trọng safe-area inset. Nút "Draw teams" sticky ở đáy, trong vùng ngón cái.
- Luồng 3 màn: Setup (mode, tên 2 người, chế độ cân bằng, mirror toggle) -> Draw (3D full screen) -> Results (2 card, chênh lệch OVR, khoá từng bên, swap, redraw, copy, share, history).
- Visual: dark theme nền xanh đêm (#07130f), panel #0d2119, chữ #f3fff8, chữ phụ #a8b9b0, accent neon #78ff9a, #c8ff53 và cyan hologram #5cf2ff, gradient accent cho nút chính. UI 2D dùng chung ngôn ngữ hologram với cảnh 3D (viền phát sáng mảnh, scanline rất nhẹ trên panel). Cảm giác sân bóng đêm và màn hình broadcast thể thao: vạch sân mờ trên nền, số dạng condensed và tabular-nums, card đội lấy cảm hứng từ thẻ game bóng đá.
- Font: system stack, hoặc inline một webfont <= 60KB (subset Latin + Latin Extended).
- Accessibility: control là button/input thật. aria-label tiếng Anh. Toggle dùng `role="switch"` + `aria-checked`. Tabs dùng `role="tab"` + `aria-selected`. Focus visible. Contrast đạt AA.

## Asset
- Cờ: package `flag-icons` (SVG). Chỉ inline đúng các cờ cần dùng, tối ưu bằng svgo. England dùng `gb-eng`, Scotland dùng `gb-sct`.
- Logo CLB: tải từ Wikimedia Commons / Wikipedia (ưu tiên SVG), tối ưu về SVG nhẹ hoặc WebP 128px. Ghi URL nguồn vào ASSET_SOURCES.md.
- Thiếu logo hoặc tải lỗi: badge monogram (`shortName`) trên nền `colors`.

## Lệnh
- `npm run fetch:ratings`: thu thập rating, cập nhật ratings.json và DATA_REPORT.md
- `npm run fetch:assets`: tải và tối ưu cờ, logo
- `npm run import:csv -- <file>`: nạp rating tay
- `npm test`: unit test logic bốc
- `npm run dev`: server local có live reload
- `npm run build`: ra dist/index.html, in kích thước file
- `npm run deploy`: build rồi `wrangler pages deploy dist`

## README.md
Bắt buộc có `README.md` ở thư mục gốc, viết tiếng Việt, cập nhật cùng lúc với mỗi thay đổi về lệnh, cấu trúc hay cách deploy. Nội dung tối thiểu:
1. Giới thiệu ngắn: app làm gì, kèm screenshot màn card reveal, VS Clash và màn kết quả.
2. Yêu cầu môi trường: phiên bản Node (khai báo trong `.nvmrc` và `engines` của package.json), npm, tài khoản Cloudflare.
3. Setup: clone, `npm install`, `npm run dev`, mở URL local trên điện thoại cùng mạng LAN (in ra IP LAN khi chạy dev).
4. Cập nhật data:
   - Chạy `fetch:ratings`, `fetch:assets`, đọc DATA_REPORT.md.
   - Cách sửa `overrides.json` (ví dụ cụ thể: đặt sao cho một tuyển nhỏ, sửa OVR của một CLB).
   - Nguồn rating (fifaindex, eloratings), cách chạy Playwright ở chế độ headed khi bị chặn, cách đổi FC 27 sang FC 26.
   - Cách nhập CSV khi mọi nguồn đều chặn fetch.
   - Cách chỉnh ngưỡng sao trong `config.js`.
   - Cách thêm hoặc bớt một đội trong `teams.json` (các field bắt buộc, chỗ đặt logo).
5. Build: `npm run build`, vị trí file output, cách kiểm tra kích thước, mở thử bằng file:// để xác nhận chạy offline.
6. Deploy Cloudflare Pages, viết từng bước có lệnh cụ thể:
   - Lần đầu: `npx wrangler login`, tạo project (`npx wrangler pages project create <tên>`), deploy (`npm run deploy`).
   - Gắn custom domain: thêm subdomain của tuhoang.app trong dashboard Pages > Custom domains, xác nhận bản ghi CNAME đã tự tạo trong DNS Cloudflare, chờ SSL active.
   - Các lần sau: chỉ cần `npm run deploy`.
   - Phương án không dùng CLI: kéo thả thư mục `dist` vào Direct Upload trên dashboard.
   - Rollback: chọn deployment cũ trong dashboard và bấm rollback.
   - Lưu ý: kiểm tra lại cú pháp lệnh wrangler theo tài liệu Cloudflare hiện hành trước khi viết, không dựa vào trí nhớ.
7. Cấu hình: bảng liệt kê các key trong `config.js` (tên, ý nghĩa, giá trị mặc định), gồm `SHOW_CLUB_LOGOS` và thời lượng animation.
8. Xử lý sự cố: fps thấp trên điện thoại, WebGL không chạy (fallback 2D), logo không hiện, deploy lỗi xác thực wrangler, localStorage bị xoá.
9. Bảng lệnh npm (copy từ mục Lệnh ở trên).

Đưa README vào tiêu chí hoàn thành của Phase 5: làm theo README từ một thư mục clone sạch phải build và deploy được mà không cần thêm bước nào khác.

## Quy trình làm việc
1. Đọc file này, đề xuất kế hoạch và cấu trúc thư mục, chờ duyệt.
2. Phase 1: data + asset. Xuất DATA_REPORT.md (đội thiếu rating, nguồn từng đội, phân bố số đội theo mức sao, logo thiếu) rồi DỪNG để tao kiểm tra.
3. Phase 2: logic bốc + test. Test tối thiểu: không trùng khi tắt mirror, khoá một bên, khoá cả hai bên, từng chế độ cân bằng (gồm khi một bên đã khoá), tier không đủ đội, đội `stars: null`, đổi mode xoá khoá.
4. Phase 3: UI 2D đầy đủ (gồm fallback).
5. Phase 4: cảnh 3D (Holographic Stadium -> 3D Team Cards -> VS Clash, làm theo thứ tự này, đo hiệu năng sau từng phần).
6. Phase 5: polish, đo hiệu năng, deploy.
Cuối mỗi phase: chạy test, build, dùng Playwright chụp screenshot ở 390x844 và 360x780 để tự kiểm tra, báo kích thước dist/index.html và fps đo được với CPU throttle 4x.

## Quy tắc
- Không bịa data: rating, màu áo, tên viết tắt không chắc chắn thì để null và ghi vào báo cáo.
- Logic bốc nằm trong `src/draw/`, là hàm thuần, không đụng DOM hay Three.js.
- Mọi chuỗi UI (tiếng Anh) tập trung trong một file `src/ui/strings.js`.
- Không thêm dependency runtime ngoài Three.js khi chưa hỏi.

## Tiêu chí hoàn thành
- Test pass. Không bao giờ bốc trùng khi tắt "Allow mirror match".
- `dist/index.html` <= 3 MB, chạy offline.
- Mọi rating có nguồn (fifaindex, elo-mapped hoặc override), không có số nào được đoán.
- Fallback 2D hoạt động khi tắt WebGL.
- Đạt ngân sách hiệu năng ở mục "Ngân sách hiệu năng" trên Android tầm trung, hoặc báo rõ lý do nếu không đạt.
- README.md đầy đủ các mục ở trên. Làm theo README từ một bản clone sạch phải setup, build và deploy được.
