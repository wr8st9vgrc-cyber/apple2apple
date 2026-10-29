// 첫 화면 [예시로 해 보기]: 효과 검증 문제 ①⑤⑧의 서류를 그대로 쓴다 (노션 4.2 3-2)
// 예시 모드에서만 맞출 칸 옆에 넣을 값을 한 줄로 안내한다
export const EXAMPLES = {
  increase: {
    note: '예시: 단골 화주의 9월 견적(사진)과 선사의 10월 회신(메일)이에요. 그대로 [다음]을 눌러 보세요',
    a: [{ url: '/examples/q01-last-quote-photo.jpg', name: '지난견적_9월_사진.jpg', kind: 'image' }],
    b: [{ url: '/examples/q01-carrier-reply.eml', name: '선사회신_10월.eml', kind: 'eml' }],
    tableHints: { 'item:THC': '예시: 요율표의 40피트 THC 200달러를 넣어 보세요' },
    checkHints: {
      'a:line': '예시: 사진을 보고 맞으면 그대로 Enter를 눌러 주세요',
      'a:amount': '예시: 사진의 금액은 1,800이에요',
      'a:miss:container': "예시: 사진에는 40' × 1로 적혀 있어요",
      'a:miss:route': '예시: 부산 → 로테르담',
      'a:miss:amount': '예시: USD 1,800',
    },
  },
  reply: {
    note: '예시: 화주의 견적 문의(메일)와 선사 운임표(PDF)예요. 우리 수수료 50달러를 미리 채워 뒀어요',
    a: [{ url: '/examples/q05-shipper-request.eml', name: '화주문의.eml', kind: 'eml' }],
    b: [{ url: '/examples/q05-rate-sheet.pdf', name: '선사운임표.pdf', kind: 'pdf' }],
    fee: 50,
    tableHints: {
      validity: '예시: 11월 운임은 아직 모르니 [모르겠어요]를 눌러 보세요 (Shift+Enter)',
      'item:DTHC': '예시: 도착항 비용도 아직 모르니 [모르겠어요]를 눌러 보세요 (Shift+Enter)',
    },
    checkHints: {},
  },
  renego: {
    note: '예시: 신규 화주에게 보낸 우리 견적(엑셀)과 화주가 보내 온 다른 포워더 견적(사진)이에요',
    a: [{ url: '/examples/q08-our-quote.xlsx', name: '우리견적.xlsx', kind: 'xlsx' }],
    b: [{ url: '/examples/q08-other-quote-photo.jpg', name: '다른포워더견적_사진.jpg', kind: 'image' }],
    tableHints: { incl: "예시: 사진에는 해상운임만 보이니 '해상운임만'을 넣어 보세요" },
    checkHints: {
      'b:line': '예시: 사진을 보고 맞으면 그대로 Enter를 눌러 주세요',
      'b:amount': '예시: 사진의 금액은 1,500이에요',
      'b:miss:container': "예시: 40' × 1",
      'b:miss:route': '예시: 부산 → 로테르담',
      'b:miss:validity': '예시: 사진 아래 작은 글씨의 2026-11-15',
      'b:miss:amount': '예시: USD 1,500',
    },
  },
}
