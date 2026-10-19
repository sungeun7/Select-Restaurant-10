const CATEGORIES = ['한식', '중식', '일식', '양식', '분식'];

// 명예의 전당 - 다른 유저들이 평가한 식당 (시드, 10점 만점, 소수점 1자리)
const SEED_RESTAURANTS = [
  { name: '청담 스시오마카세', rating: 9.8, category: '일식' },
  { name: '강남 한우스테이크', rating: 9.6, category: '양식' },
  { name: '이태원 파스타집', rating: 9.4, category: '양식' },
  { name: '홍대 감성타코', rating: 9.3, category: '양식' },
  { name: '성수 브런치카페', rating: 9.2, category: '양식' },
  { name: '을지로 한정식', rating: 9.1, category: '한식' },
  { name: '잠실 맛집횟집', rating: 9.0, category: '일식' },
  { name: '압구정 디저트카페', rating: 8.9, category: '양식' },
  { name: '광화문 한식당', rating: 8.8, category: '한식' },
  { name: '이태원 와인바', rating: 8.7, category: '양식' },
];

// 명예의 전당 - 한 주 포인트 시드 (다른 유저)
const SEED_WEEKLY_USERS = [
  { name: '맛집탐험가', weeklyPoints: 320 },
  { name: '음식천재', weeklyPoints: 280 },
  { name: '배달의민족', weeklyPoints: 250 },
  { name: '요리사', weeklyPoints: 220 },
  { name: '푸드스타그램', weeklyPoints: 200 },
];

function toRating10(v) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  // 예전 5점제(1~5 정수)는 2배로 환산
  if (n >= 1 && n <= 5 && n === Math.round(n)) return Math.round(n * 20) / 10;
  // 0~10 제한 및 소수점 1자리
  return Math.round(Math.min(10, Math.max(0, n)) * 10) / 10;
}

module.exports = { CATEGORIES, SEED_RESTAURANTS, SEED_WEEKLY_USERS, toRating10 };

