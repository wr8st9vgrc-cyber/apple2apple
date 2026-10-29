// 사전·코드표 (3.4 '쓰는 데이터'). 규칙을 고칠 때 이 표만 고치면 된다.

// 항목 이름 사전: 서류마다 다른 이름 → 같은 이름
export const ITEMS = [
  { key: 'DTHC', label: 'DTHC (도착항 비용)', words: ['dthc', 'destinationthc', '도착항비용', '도착지비용', '목적지비용', '도착항thc'] },
  { key: 'THC', label: 'THC', words: ['originthc', 'thc', 'terminalhandling', '터미널조작료', '터미널처리비', '터미널화물처리비', '터미널핸들링', 'localcharges', 'localcharge', '부대비용'] },
  { key: 'BAF', label: 'BAF (유류할증료)', words: ['baf', 'bunker', '유류할증료', '유류할증'] },
  { key: 'DOC', label: '서류비', words: ['docfee', 'doc', 'b/lfee', 'blfee', '서류발급비', '서류비', 'documentation'] },
  { key: 'INLAND', label: '내륙운송', words: ['내륙운송', 'trucking', 'inland', '내륙운송비'] },
  { key: 'FEE', label: '수수료', words: ['수수료', 'handlingcharge', 'handlingfee'] },
  { key: 'SEAL', label: 'Seal Fee', words: ['sealfee', 'seal'] },
  { key: 'ALLIN', label: 'All-in', words: ['all-in', 'allin', '올인'] },
  { key: 'OF', label: '해상운임', words: ['basicoceanfreight', 'oceanfreight', 'o/f', '해상운임', '기본운임', 'oceancreight', 'oceanfreig', 'freight'] },
]
export const ITEM_LABEL = Object.fromEntries(ITEMS.map((i) => [i.key, i.label]))

// 항구 코드표 (UN/LOCODE). MVP는 부산과 주요 도착항 몇 곳만
export const PORTS = [
  { code: 'KRPUS', ko: '부산', words: ['부산', 'busan', 'pusan', 'krpus', '부산항', '부산신항'] },
  { code: 'NLRTM', ko: '로테르담', words: ['로테르담', 'rotterdam', 'nlrtm'] },
  { code: 'DEHAM', ko: '함부르크', words: ['함부르크', 'hamburg', 'deham'] },
  { code: 'BEANR', ko: '앤트워프', words: ['앤트워프', 'antwerp', 'beanr'] },
  { code: 'USLGB', ko: '롱비치', words: ['롱비치', 'longbeach', 'uslgb'] },
  { code: 'USLAX', ko: 'LA', words: ['losangeles', '로스앤젤레스', 'uslax', 'la'] },
  { code: 'USOAK', ko: '오클랜드', words: ['oakland', '오클랜드', 'usoak'] },
  { code: 'USSEA', ko: '시애틀', words: ['seattle', '시애틀', 'ussea'] },
  { code: 'CAVAN', ko: '밴쿠버', words: ['vancouver', '밴쿠버', 'cavan'] },
  { code: 'SGSIN', ko: '싱가포르', words: ['싱가포르', 'singapore', 'sgsin'] },
  { code: 'VNHPH', ko: '하이퐁', words: ['하이퐁', 'haiphong', 'vnhph'] },
  { code: 'VNSGN', ko: '호치민', words: ['호치민', 'hochiminh', 'catlai', 'vnsgn'] },
  { code: 'THBKK', ko: '방콕', words: ['방콕', 'bangkok', 'thbkk', 'laemchabang'] },
  { code: 'AEJEA', ko: '제벨알리', words: ['제벨알리', '제별알리', 'jebelali', 'aejea'] },
]
export const PORT_NAME = Object.fromEntries(PORTS.map((p) => [p.code, p.ko]))

// 조건 표현 사전
export const INCLUDED = /(포함|incl\.?|included|including|inclusive)/i
export const EXCLUDED = /(별도|별노|불포함|excl\.?|excluded|not included|collect)/i
export const PER_TARIFF = /(as per (local )?tariff|as per monthly notice|as per notice|per local tariff|월별 공지|공지에 따름)/i
export const TBA = /\b(tba|tbc|tbd)\b|추후 ?안내|추후 ?통보|미정/i
export const NA = /\b(n\/a|na)\b|운임 ?없음/i
export const DOOR = /(문 ?앞|공장|door|도어|상차|d2d)/i
export const PORT_TERM = /\b(cy|port)\b|항구|항\b|부산 ?cy|cy[-–/ ]?cy/i
