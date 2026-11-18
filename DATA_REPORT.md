# DATA_REPORT

Sinh tự động bởi `npm run fetch:ratings` / `npm run report`. Lần chạy: 2026-11-18T09:26:17.388Z.

- Nguồn chính: fifaindex.com, bản **FC27**. Dữ liệu fifaindex lấy lúc: 2026-11-18T09:18:32.010Z → 2026-11-18T09:24:39.475Z.
- Elo: eloratings.net (World.tsv), lấy lúc 2026-11-18T09:17:44.521Z.
- Rating EA FC chỉ là proxy để xếp sao, thang khác engine PES.

## Tóm tắt

| Nguồn | Số đội |
|---|---:|
| elo-mapped | 17 |
| fifaindex-fc27 | 68 |
| **Tổng** | **85** |

## Đội thiếu rating

Không có. Mọi đội đều có rating từ fifaindex, elo-mapped hoặc override.

## Ngưỡng sao

OVR tối thiểu cho từng mức (dưới mức 1.5★ là 1★). Club và tuyển dùng chung một thang.

| Mức | 1.5★ | 2★ | 2.5★ | 3★ | 3.5★ | 4★ | 4.5★ | 5★ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Quantile (gợi ý) | 73 | 76 | 77 | 78 | 79 | 80 | 82 | 84 |
| Đang dùng (config.js) | 73 | 76 | 77 | 78 | 79 | 80 | 82 | 84 |

## Phân bố số đội theo mức sao

| Sao | National | Clubs | Mixed |
|---|---:|---:|---:|
| 5★ | 6 | 6 | 12 |
| 4.5★ | 2 | 4 | 6 |
| 4★ | 2 | 7 | 9 |
| 3.5★ | 5 | 8 | 13 |
| 3★ | 5 | 3 | 8 |
| 2.5★ | 3 | 5 | 8 |
| 2★ | 7 | 3 | 10 |
| 1.5★ | 9 | 1 | 10 |
| 1★ | 9 | 0 | 9 |
| null | 0 | 0 | 0 |

- Clubs: mức 1.5★ chỉ có 1 đội, "Same tier" sẽ không chọn mức này.

## Quy đổi Elo sang OVR

Hồi quy tuyến tính `OVR = a + b × Elo` trên 31 tuyển có cả fifaindex và Elo:

- a = 40.667
- b = 0.02030
- R² = 0.761

<details><summary>Các tuyển dùng để hồi quy</summary>

| Đội | Elo | OVR fifaindex | OVR dự đoán | Sai số |
|---|---:|---:|---:|---:|
| Mexico | 1841 | 77 | 78.0 | -1.0 |
| United States | 1811 | 78 | 77.4 | 0.6 |
| Argentina | 2158 | 82 | 84.5 | -2.5 |
| Brazil | 1983 | 84 | 80.9 | 3.1 |
| Uruguay | 1870 | 79 | 78.6 | 0.4 |
| Colombia | 1987 | 78 | 81.0 | -3.0 |
| Paraguay | 1856 | 76 | 78.3 | -2.3 |
| Morocco | 1899 | 79 | 79.2 | -0.2 |
| Egypt | 1703 | 74 | 75.2 | -1.2 |
| Ghana | 1515 | 75 | 71.4 | 3.6 |
| DR Congo | 1675 | 75 | 74.7 | 0.3 |
| Japan | 1898 | 77 | 79.2 | -2.2 |
| Australia | 1773 | 72 | 76.7 | -4.7 |
| Qatar | 1455 | 69 | 70.2 | -1.2 |
| Saudi Arabia | 1642 | 72 | 74.0 | -2.0 |
| New Zealand | 1563 | 70 | 72.4 | -2.4 |
| England | 2182 | 84 | 85.0 | -1.0 |
| France | 2069 | 86 | 82.7 | 3.3 |
| Croatia | 1858 | 80 | 78.4 | 1.6 |
| Portugal | 2005 | 84 | 81.4 | 2.6 |
| Norway | 1935 | 79 | 80.0 | -1.0 |
| Germany | 1953 | 84 | 80.3 | 3.7 |
| Netherlands | 1952 | 82 | 80.3 | 1.7 |
| Belgium | 1994 | 81 | 81.2 | -0.2 |
| Spain | 2258 | 86 | 86.5 | -0.5 |
| Switzerland | 1976 | 79 | 80.8 | -1.8 |
| Austria | 1838 | 78 | 78.0 | 0.0 |
| Scotland | 1715 | 76 | 75.5 | 0.5 |
| Czechia | 1647 | 76 | 74.1 | 1.9 |
| Sweden | 1783 | 78 | 76.9 | 1.1 |
| Türkiye | 1750 | 79 | 76.2 | 2.8 |

</details>

Tuyển được quy đổi (hiện nhãn "est." trong app):

| Đội | Elo | OVR ước lượng |
|---|---:|---:|
| Canada | 1762 | 76 |
| Panama | 1661 | 74 |
| Haiti | 1545 | 72 |
| Curaçao | 1484 | 71 |
| Ecuador | 1856 | 78 |
| Tunisia | 1488 | 71 |
| Algeria | 1688 | 75 |
| Cape Verde | 1521 | 72 |
| South Africa | 1593 | 73 |
| Côte d'Ivoire | 1719 | 76 |
| Senegal | 1812 | 77 |
| Iran | 1743 | 76 |
| Uzbekistan | 1646 | 74 |
| South Korea | 1723 | 76 |
| Jordan | 1644 | 74 |
| Iraq | 1539 | 72 |
| Bosnia and Herzegovina | 1672 | 75 |

## Rating đội tuyển

| Đội | OVR | ATT | MID | DEF | Sao | Nguồn | Tên trên nguồn |
|---|---:|---:|---:|---:|---:|---|---|
| France | 86 | 87 | 85 | 85 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1335-france) |  |
| Spain | 86 | 86 | 86 | 84 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1362-spain) |  |
| Brazil | 84 | 86 | 82 | 83 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1370-brazil) |  |
| England | 84 | 85 | 86 | 84 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1318-england) |  |
| Portugal | 84 | 83 | 86 | 84 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1354-portugal) |  |
| Germany | 84 | 83 | 84 | 85 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1337-germany) |  |
| Argentina | 82 | 86 | 83 | 80 | 4.5 | [fifaindex-fc27](https://fifaindex.com/teams/1369-argentina) |  |
| Netherlands | 82 | 80 | 83 | 82 | 4.5 | [fifaindex-fc27](https://fifaindex.com/teams/105035-netherlands) |  |
| Belgium | 81 | 82 | 82 | 78 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/1325-belgium) |  |
| Croatia | 80 | 81 | 79 | 79 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/1328-croatia) |  |
| Uruguay | 79 | 76 | 80 | 77 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/1377-uruguay) |  |
| Morocco | 79 | 79 | 79 | 77 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/111111-morocco) |  |
| Norway | 79 | 80 | 81 | 76 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/1352-norway) |  |
| Switzerland | 79 | 77 | 78 | 78 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/1364-switzerland) |  |
| Türkiye | 79 | 79 | 81 | 79 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/1365-turkiye) |  |
| United States | 78 | 78 | 78 | 78 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/1387-united-states) |  |
| Ecuador | 78 est. | — | — | — | 3 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Colombia | 78 | 80 | 79 | 78 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/111109-colombia) |  |
| Austria | 78 | 76 | 78 | 79 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/1322-austria-national-team) | Austria (National team) |
| Sweden | 78 | 83 | 75 | 77 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/1363-sweden) |  |
| Mexico | 77 | 79 | 76 | 75 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/1386-mexico) |  |
| Senegal | 77 est. | — | — | — | 2.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Japan | 77 | 78 | 78 | 77 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/1411-japan) |  |
| Canada | 76 est. | — | — | — | 2 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Paraguay | 76 | 76 | 75 | 75 | 2 | [fifaindex-fc27](https://fifaindex.com/teams/1375-paraguay) |  |
| Côte d'Ivoire | 76 est. | — | — | — | 2 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Iran | 76 est. | — | — | — | 2 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| South Korea | 76 est. | — | — | — | 2 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Scotland | 76 | 77 | 77 | 75 | 2 | [fifaindex-fc27](https://fifaindex.com/teams/1359-scotland) |  |
| Czechia | 76 | 75 | 75 | 76 | 2 | [fifaindex-fc27](https://fifaindex.com/teams/1330-czechia) |  |
| Algeria | 75 est. | — | — | — | 1.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Ghana | 75 | 68 | 76 | 73 | 1.5 | [fifaindex-fc27](https://fifaindex.com/teams/111462-ghana) |  |
| DR Congo | 75 | 77 | 73 | 74 | 1.5 | [fifaindex-fc27](https://fifaindex.com/teams/111545-congo-dr) | Congo DR |
| Bosnia and Herzegovina | 75 est. | — | — | — | 1.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Panama | 74 est. | — | — | — | 1.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Egypt | 74 | 76 | 75 | 72 | 1.5 | [fifaindex-fc27](https://fifaindex.com/teams/111130-egypt) |  |
| Uzbekistan | 74 est. | — | — | — | 1.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Jordan | 74 est. | — | — | — | 1.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| South Africa | 73 est. | — | — | — | 1.5 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Haiti | 72 est. | — | — | — | 1 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Cape Verde | 72 est. | — | — | — | 1 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Australia | 72 | 71 | 69 | 72 | 1 | [fifaindex-fc27](https://fifaindex.com/teams/1415-australia) |  |
| Saudi Arabia | 72 | 73 | 73 | 72 | 1 | [fifaindex-fc27](https://fifaindex.com/teams/111114-saudi-arabia) |  |
| Iraq | 72 est. | — | — | — | 1 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Curaçao | 71 est. | — | — | — | 1 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| Tunisia | 71 est. | — | — | — | 1 | [elo-mapped](https://eloratings.net/World.tsv) |  |
| New Zealand | 70 | 74 | 71 | 69 | 1 | [fifaindex-fc27](https://fifaindex.com/teams/111473-new-zealand) |  |
| Qatar | 69 | 74 | 67 | 66 | 1 | [fifaindex-fc27](https://fifaindex.com/teams/111527-qatar) |  |

## Rating CLB

| Đội | OVR | ATT | MID | DEF | Sao | Nguồn | Tên trên nguồn |
|---|---:|---:|---:|---:|---:|---|---|
| Arsenal | 85 | 83 | 85 | 83 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/1-arsenal) |  |
| Barcelona | 85 | 86 | 85 | 83 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/241-fc-barcelona) | FC Barcelona |
| Real Madrid | 85 | 86 | 86 | 83 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/243-real-madrid) |  |
| Paris Saint-Germain | 85 | 87 | 85 | 86 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/73-paris-saint-germain) |  |
| Manchester City | 84 | 87 | 84 | 84 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/10-manchester-city) |  |
| Bayern Munich | 84 | 90 | 84 | 84 | 5 | [fifaindex-fc27](https://fifaindex.com/teams/21-bayern-munchen) | Bayern München |
| Liverpool | 83 | 85 | 83 | 81 | 4.5 | [fifaindex-fc27](https://fifaindex.com/teams/9-liverpool) |  |
| Atlético Madrid | 83 | 84 | 83 | 81 | 4.5 | [fifaindex-fc27](https://fifaindex.com/teams/240-atletico-de-madrid) | Atlético de Madrid |
| Manchester United | 82 | 83 | 83 | 80 | 4.5 | [fifaindex-fc27](https://fifaindex.com/teams/11-manchester-united) |  |
| Inter | 82 | 83 | 83 | 81 | 4.5 | [fifaindex-fc27](https://fifaindex.com/teams/131682-inter) |  |
| Borussia Dortmund | 81 | 85 | 80 | 80 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/22-borussia-dortmund) |  |
| Napoli | 81 | 79 | 83 | 79 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/48-napoli) |  |
| Tottenham Hotspur | 81 | 80 | 80 | 81 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/18-tottenham-hotspur) |  |
| Chelsea | 81 | 81 | 82 | 79 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/5-chelsea) |  |
| Roma | 80 | 83 | 78 | 81 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/52-roma) |  |
| AC Milan | 80 | 80 | 79 | 79 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/131681-milano-fc) | Milano FC |
| Juventus | 80 | 78 | 78 | 80 | 4 | [fifaindex-fc27](https://fifaindex.com/teams/45-juventus) |  |
| Aston Villa | 79 | 79 | 78 | 79 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/2-aston-villa) |  |
| Villarreal | 79 | 80 | 79 | 78 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/483-villarreal-cf) | Villarreal CF |
| Real Betis | 79 | 79 | 80 | 78 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/449-real-betis-balompie) | Real Betis Balompié |
| RB Leipzig | 79 | 78 | 78 | 80 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/112172-rb-leipzig) |  |
| Newcastle United | 79 | 79 | 78 | 81 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/13-newcastle-united) |  |
| Atalanta | 79 | 79 | 78 | 77 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/115845-atalanta) |  |
| Bayer Leverkusen | 79 | 80 | 79 | 79 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/32-bayer-04-leverkusen) | Bayer 04 Leverkusen |
| Galatasaray | 79 | 85 | 79 | 78 | 3.5 | [fifaindex-fc27](https://fifaindex.com/teams/325-galatasaray) |  |
| VfB Stuttgart | 78 | 77 | 79 | 78 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/36-vfb-stuttgart) |  |
| Como | 78 | 80 | 78 | 77 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/1745-como) |  |
| Benfica | 78 | 80 | 79 | 77 | 3 | [fifaindex-fc27](https://fifaindex.com/teams/234-benfica) |  |
| Lyon | 77 | 75 | 77 | 76 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/66-olympique-lyonnais) | Olympique Lyonnais |
| Hoffenheim | 77 | 77 | 77 | 76 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/10029-tsg-1899-hoffenheim) | TSG 1899 Hoffenheim |
| Sporting CP | 77 | 79 | 75 | 78 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/237-sporting-cp) |  |
| Olympiacos | 77 | 80 | 77 | 74 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/280-olympiacos) |  |
| Monaco | 77 | 75 | 77 | 75 | 2.5 | [fifaindex-fc27](https://fifaindex.com/teams/69-as-monaco) | AS Monaco |
| Lens | 76 | 78 | 75 | 77 | 2 | [fifaindex-fc27](https://fifaindex.com/teams/64-rc-lens) | RC Lens |
| Lille | 76 | 77 | 76 | 77 | 2 | [fifaindex-fc27](https://fifaindex.com/teams/65-losc-lille) | LOSC Lille |
| Marseille | 76 | 77 | 76 | 76 | 2 | [fifaindex-fc27](https://fifaindex.com/teams/219-olympique-de-marseille) | Olympique de Marseille |
| Club Brugge | 74 | 74 | 71 | 72 | 1.5 | [fifaindex-fc27](https://fifaindex.com/teams/231-club-brugge) |  |

## Logo và cờ

- Cờ: 51 file SVG từ package flag-icons.
- Logo CLB: 11/37 có file. Nguồn từng logo xem ASSET_SOURCES.md.
- Thiếu logo (dùng badge monogram): Liverpool (HTTP 429 https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Barcelona (HTTP 429 https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Real Madrid (HTTP 429 https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Villarreal (HTTP 429 https://upload.wikimedia.org/wikipedia/en/b/b9/Villarreal_CF_logo-en.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Atlético Madrid (HTTP 429 https://upload.wikimedia.org/wikipedia/en/f/f9/Atletico_Madrid_Logo_2024.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Lille (HTTP 429 https://upload.wikimedia.org/wikipedia/en/3/3f/Lille_OSC_2018_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Lyon (HTTP 429 https://upload.wikimedia.org/wikipedia/en/1/1c/Olympique_Lyonnais_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Marseille (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/4/4f/Olympique_de_Marseille_2026_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Borussia Dortmund (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), RB Leipzig (HTTP 429 https://upload.wikimedia.org/wikipedia/en/0/04/RB_Leipzig_2014_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), VfB Stuttgart (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/e/eb/VfB_Stuttgart_1893_Logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Hoffenheim (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/e/e7/Logo_TSG_Hoffenheim.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Inter (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Roma (HTTP 429 https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Como (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/9/99/Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), AC Milan (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Tottenham Hotspur (HTTP 429 https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Chelsea (HTTP 429 https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Sporting CP (HTTP 429 https://upload.wikimedia.org/wikipedia/en/9/97/Sporting_Clube_de_Portugal_logo_%282026%29.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Newcastle United (HTTP 429 https://upload.wikimedia.org/wikipedia/en/8/87/Newcastle_United_FC_2026_crest.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Atalanta (HTTP 429 https://upload.wikimedia.org/wikipedia/en/f/f2/Atalanta_BC_new_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Bayer Leverkusen (HTTP 429 https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Olympiacos (HTTP 429 https://upload.wikimedia.org/wikipedia/en/a/a2/Olympiacos_FC_crest.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Club Brugge (HTTP 429 https://upload.wikimedia.org/wikipedia/en/d/d0/Club_Brugge_KV_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Galatasaray (HTTP 429 https://upload.wikimedia.org/wikipedia/commons/0/07/Galatasaray_S.K._Logo_2026_5-stars.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original), Benfica (HTTP 429 https://upload.wikimedia.org/wikipedia/en/a/a2/SL_Benfica_logo.svg?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=original)
- Logo chuyển sang WebP 128px (SVG gốc quá nặng hoặc gốc là ảnh raster): Real Betis, Lens
- Tổng dung lượng asset: cờ 313.2 KB, logo 96.0 KB.

## Ghi chú data

- `shortName` đội tuyển là mã FIFA 3 chữ. `shortName` CLB là viết tắt thông dụng trên broadcast (Lyon `OL`, Marseille `OM` giữ 2 chữ theo cách gọi phổ biến).
- `colors` là màu áo chính/phụ ở mức gần đúng, dùng cho viền card và badge dự phòng, không phải mã màu thương hiệu chính thức. Sửa trực tiếp trong teams.json nếu thấy lệch.
- AC Milan trên fifaindex FC 27 mang tên "Milano FC" (không có bản quyền tên). Đã xác nhận qua trang đội: đội trưởng Mike Maignan, đội hình có Pulisic, Modrić, Rabiot, đối thủ là Inter.
- Tên trên eloratings khác tên app: Côte d'Ivoire = "Ivory Coast", Türkiye = "Turkey". Tên trên fifaindex khác: xem cột "Tên trên nguồn".

<!-- manual:performance -->
## Performance

Đo bằng `npm run perf` ngày 2026-11-18: Playwright + CDP, viewport 390×844 @2x, **CPU throttle 4x**, build `dist/index.html` 1022.7 KB.

### GPU thật (ANGLE D3D11, Intel Iris Xe laptop)

| Chuỗi | fps TB | p95 frame (ms) | frame dài nhất (ms) | số frame > 50 ms |
|---|---:|---:|---:|---:|
| full draw | 59.2 | 16.7 | 66.7 | 1 |
| redraw one side | 59.7 | 16.7 | 33.3 | 0 |

Scene: 17 draw call, 1138 triangle, 4 texture (2 mặt card 512×768, mặt sau, VS 256×256; khoảng 6.6 MB kèm mipmap, ngân sách 48 MB), tier `high`, DPR 2.

### GPU phần mềm (SwiftShader, kịch bản xấu nhất)

| Chuỗi | fps TB | p95 frame (ms) | frame dài nhất (ms) | số frame > 50 ms |
|---|---:|---:|---:|---:|
| full draw | 50.5 | 33.4 | 83.4 | 3 |
| redraw one side | 55.4 | 33.4 | 33.4 | 0 |

Tier tự hạ từ `high` xuống `medium` (DPR 1.5) sau khoảng 1.5s fps thấp.

### Nhận xét
- Ngân sách: draw call ≤ 60 (đang 17), triangle ≤ 150k (đang ~1.1k), texture ≤ 1024px (lớn nhất 512×768), không có light và shadow, mọi material đều unlit.
- Frame > 50 ms duy nhất còn lại nằm ở ~100–170 ms đầu sau khi bấm Draw: chuyển DOM từ Setup sang Draw và giải mã ảnh cờ/logo lần đầu. Lúc đó canvas còn ẩn và timeline chưa chạy. Trong chính chuỗi animation (boot → card → clash) không có frame nào > 50 ms trên GPU thật. Redraw một bên: frame dài nhất 16.8–33 ms.
- Đã xử lý jank: compile shader + upload texture trong lúc idle sau khi Setup hiện; vẽ mặt card rải qua nhiều frame; canvas 2D dùng `willReadFrequently` để upload texture không phải đọc ngược từ GPU; tắt `checkShaderErrors` khi không debug.
- Bloom và chromatic aberration toàn màn hình **chưa làm** (CLAUDE.md cho phép chỉ bật ở tier high). Glow hiện dùng sprite additive và emissive trong shader.

### Thiết bị thật (Android)
**Chưa đo.** Cần chạy `npm run dev`, mở `http://<IP LAN>:5173/?debug=1` trên điện thoại (vd Galaxy A54), bấm Draw vài lần rồi ghi fps, frame time và tier từ HUD vào đây.
<!-- /manual:performance -->
