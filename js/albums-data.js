// 프로미스나인 국내 발매 음반 + OST
// 음반: 영문 위키백과 Fromis 9 discography·각 음반 문서, 한국어 위키백과 (2026-11-15 확인). 일본 발매 제외.
// OST: 사용자 요청으로 '5인 체제(2025~) 이후 발매' 또는 '현 5인(하영·지원·채영·나경·지헌)만 참여한 곡'만.
//   예외: 작전명 순정 Love Me Back 은 사용자 요청으로 넣음. (크레이지 러브 Stay Alive·싸이월드 별 은 다른 멤버도 참여해서 뺌)
// 개인곡: 현 5인 멤버 이름으로 나온 OST 아닌 곡 (사용자 요청). 달빛바다(2022 여름방학 프로젝트)도 사용자 요청으로 넣음
//   참여 멤버: 애플 뮤직 크레딧(유닛·솔로) / 나무위키 가사 표기(단체곡) 기준
// 커버: 애플 뮤직 공식 이미지 주소만 적어 두고 앱이 불러와서 보여줌 (이미지 파일은 저장소에 안 넣음)
// 새 앨범은 앱의 '앨범 추가'로 직접 넣을 수 있어요.
export const TYPE_NAMES = { studio: '정규', ep: '미니', 'single-album': '싱글 앨범', 'digital-single': '디지털 싱글', ost: 'OST', solo: '개인곡', etc: '기타' };

const ART = 'https://is1-ssl.mzstatic.com/image/thumb/';
export const coverURL = (a, size = 600) => (a?.art ? `${ART}${a.art}/${size}x${size}bb.jpg` : '');

export const DISCOGRAPHY = [
  { id: 'a-2017-11-30', title: 'Glass Shoes', ko: '유리구두', type: 'digital-single', date: '2017-11-30', lead: ['Glass Shoes'], tracks: ['Glass Shoes'], art: 'Music116/v4/3d/ec/0c/3dec0c9b-3b7d-373e-2773-d87bd4b61d9f/8809534469084_Cover.jpg' },
  { id: 'a-2018-01-24', title: 'To. Heart', type: 'ep', date: '2018-01-24', lead: ['To Heart'], tracks: ['The Way To Me', 'To Heart', 'Miracle', 'Pinocchio', 'Be With You', 'Glass Shoes (MAMA Ver.)'], art: 'Music126/v4/83/4a/06/834a06ff-abf3-62bf-d6b7-f1caa0608141/8809534469602_Cover.jpg' },
  { id: 'a-2018-06-05', title: 'To. Day', type: 'ep', date: '2018-06-05', lead: ['Pitapat (DKDK)'], tracks: ['Close To You', 'Think of You', 'Pitapat (DKDK)', '22Century Girl', 'Clover', 'First Love'], art: 'Music116/v4/6d/c3/6e/6dc36e4f-f8bf-b2f2-a8b9-556133951151/8809603542120_Cover.jpg' },
  { id: 'a-2018-10-10', title: 'From.9', type: 'single-album', date: '2018-10-10', lead: ['Love Bomb'], tracks: ['Love Bomb', 'Dancing Queen', 'Coloring (물들어)', 'DKDK (From.9 ver.)', '22nd Century Girl (From.9 ver.)'], art: 'Music125/v4/78/50/47/785047a8-d5ae-c337-d647-d567932088d4/8809603546494_Cover.jpg' },
  { id: 'a-2019-06-04', title: 'Fun Factory', type: 'single-album', date: '2019-06-04', lead: ['Fun!'], tracks: ['Fun!', 'Love RumPumPum', 'Fly High'], art: 'Music125/v4/c9/c0/28/c9c02882-0bd3-0be8-49cd-e14abf2d959b/8809658312952_Cover.jpg' },
  { id: 'a-2020-09-16', title: 'My Little Society', type: 'ep', date: '2020-09-16', lead: ['Feel Good (Secret Code)'], tracks: ['Feel Good (Secret Code)', 'Weather', 'Starry Night', 'Somebody to love', 'Mulgogi'], art: 'Music116/v4/a3/23/5c/a3235c13-e7d8-5cd5-2f09-c35bc8642125/888272068313_Cover.jpg' },
  { id: 'a-2021-05-17', title: '9 WAY TICKET', type: 'single-album', date: '2021-05-17', lead: ['We Go'], tracks: ['Airplane Mode', 'We Go', 'Promise'], art: 'Music115/v4/f3/f4/e0/f3f4e0c0-b6be-877f-bf6e-1523c2d491af/00888272080643_Cover.jpg' },
  { id: 'a-2021-09-01', title: 'Talk & Talk', type: 'single-album', date: '2021-09-01', lead: ['Talk & Talk'], tracks: ['Talk & Talk'], art: 'Music125/v4/b1/16/ea/b116ea47-1559-6c5c-3015-b73918ba9695/192641682056_Cover.jpg' },
  { id: 'a-2022-01-17', title: 'Midnight Guest', type: 'ep', date: '2022-01-17', lead: ['DM'], tracks: ['Escape Room', 'DM', 'Love is Around', 'Hush Hush', '0g'], art: 'Music116/v4/f7/1e/6a/f71e6a37-19e9-8d33-baa2-7d71c76d440f/192641683183_Cover.jpg' },
  { id: 'a-2022-07-24', title: 'Sea of Moonlight', ko: '달빛바다', type: 'digital-single', date: '2022-07-24', drama: '여름방학 프로젝트 Vol.1', lead: ['Sea of Moonlight'], tracks: ['Sea of Moonlight'], art: 'Music122/v4/40/1e/5b/401e5bf4-8db6-5382-2feb-cb25530ddf42/5054197268533.jpg' },
  { id: 'a-2022-06-27', title: 'From Our Memento Box', type: 'ep', date: '2022-06-27', lead: ['Stay This Way'], tracks: ['Up And', 'Stay This Way', 'Blind Letter', 'Cheese', 'Rewind'], art: 'Music122/v4/20/bc/71/20bc7113-c509-acc6-cbcd-efd597f3e7a0/192641872471_Cover.jpg' },
  { id: 'a-2023-06-05', title: 'Unlock My World', type: 'studio', date: '2023-06-05', lead: ['#menow'], tracks: ['Attitude', '#menow', 'Wishlist', 'In the Mirror', "Don't Care", 'Prom Night', 'Bring It On', 'What I Want', 'My Night Routine', 'Eye Contact'], art: 'Music126/v4/96/dd/8f/96dd8fb2-a58a-6432-4c77-c79bf07f2fdd/196922461620_Cover.jpg' },
  { id: 'a-2024-08-12', title: 'Supersonic', type: 'single-album', date: '2024-08-12', lead: ['Supersonic'], tracks: ['Supersonic', 'Beat the Heat', 'Take a Chance'], art: 'Music211/v4/c9/05/b0/c905b007-01a2-3f53-32e3-f30e5593ff24/198704060052_Cover.jpg' },
  { id: 'a-2024-12-23', title: 'From', type: 'digital-single', date: '2024-12-23', lead: ['From'], tracks: ['From'], art: 'Music221/v4/e4/0a/80/e40a80c5-4bb4-f8a3-393d-9bbd0d200e58/198704295768_Cover.jpg' },
  { id: 'a-2025-06-25', title: "From Our 20's", type: 'ep', date: '2025-06-25', lead: ['Like You Better'], tracks: ['Like You Better', 'Rebelutional', 'Love=Disaster', 'Strawberry Mimosa', 'Twisted Love', 'Merry Go Round'], art: 'Music221/v4/a9/15/90/a91590ad-9288-049a-d8f7-dd4aa63f1113/191953455365.jpg' },
  { id: 'a-2025-12-02', title: 'White Memories', ko: '하얀 그리움', type: 'digital-single', date: '2025-12-02', lead: ['White Memories'], tracks: ['White Memories'], art: 'Music211/v4/ab/00/f6/ab00f68e-90fd-0930-f604-9d014e0c47e2/191953496856.jpg' },
  { id: 'a-2026-07-21', title: 'Glow Me', type: 'studio', date: '2026-07-21', lead: ['Vitamin Me'], tracks: ['Eternal', 'Vitamin Me', 'Pocket Treat', 'Blue Heart', 'Screen Time', 'Teacher', 'Cold Blood', 'Why Do I Cry?', 'Day 1', 'Wonderland'], art: 'Music221/v4/db/44/03/db440319-e991-e392-c8a8-750cb0134206/191953562353.jpg' },

  // ---- OST (title = 곡 이름, drama = 작품, artist = 부른 멤버) ----
  { id: 'o-2018-10-27', title: 'Fall in Love', type: 'ost', date: '2018-10-27', drama: '하나뿐인 내편 OST Part 6', artist: '하영', tracks: ['Fall in Love'], art: 'Music221/v4/77/18/a2/7718a209-4117-ef84-039f-8a777568b0f0/8809649888473.jpg' },
  { id: 'o-2019-05-21', title: '지금부터 시작해', type: 'ost', date: '2019-05-21', drama: '초면에 사랑합니다 OST Part 6', artist: '지원 · 나경', tracks: ['지금부터 시작해'], art: 'Music123/v4/6d/f7/60/6df760a6-54ee-f306-dc2e-8662974b7d67/8809669785738.jpg' },
  { id: 'o-2021-07-13', title: 'Cloud', type: 'ost', date: '2021-07-13', drama: '라켓소년단 OST Part 5', artist: '지원', tracks: ['Cloud'], art: 'Music125/v4/f7/23/b5/f723b5c6-6bcf-df74-0e70-d2dbe690706a/8809829795706.jpg' },
  { id: 'o-2023-01-12', title: '내 곁을 떠나지 말아요', ko: "Don't Leave Me", type: 'ost', date: '2023-01-12', drama: '조선 정신과 의사 유세풍 2 OST Part 1', artist: '지원', tracks: ['내 곁을 떠나지 말아요'], art: 'Music113/v4/d5/b4/77/d5b477e6-a30a-2d18-1a88-e6502e7b7d30/191953254999.jpg' },
  { id: 'o-2023-10-11', title: 'Love Me Back', type: 'ost', date: '2023-10-11', drama: '작전명 순정 (네이버 웹툰) OST', artist: '프로미스나인', tracks: ['Love Me Back'], art: 'Music126/v4/6d/86/83/6d868370-c3ed-f353-d35c-e813b8820cb9/191953309378.jpg' },
  { id: 'o-2024-11-26', title: '봄처럼 다가와', ko: 'Come Closer Like Spring', type: 'ost', date: '2024-11-26', drama: '취하는 로맨스 OST Part 8', artist: '하영 · 나경', tracks: ['봄처럼 다가와'], art: 'Music221/v4/c4/31/86/c4318691-5e39-d832-134d-f8b1703df153/888272143966.jpg' },
  { id: 'o-2025-08-01', title: 'Touchdown', type: 'ost', date: '2025-08-01', drama: '트라이: 우리는 기적이 된다 OST Part 2', artist: '프로미스나인', tracks: ['Touchdown'], art: 'Music221/v4/e4/df/46/e4df46ed-e1ed-ac70-e693-483a294339a5/8804775421082.jpg' },
  { id: 'o-2026-01-18', title: '기억앨범', ko: 'The Shape of Memories', type: 'ost', date: '2026-01-18', drama: '언더커버 미쓰홍 OST Part 1', artist: '하영', tracks: ['기억앨범'], art: 'Music221/v4/c9/b0/4e/c9b04e9b-a4bd-4cdc-d2ef-3ca6341218de/cover_KM0024084_1.jpg' },
  { id: 'o-2026-03-17', title: 'Swipe It Out', type: 'ost', date: '2026-03-17', drama: '월간남친 OST Part 2', artist: '프로미스나인', tracks: ['Swipe It Out'], art: 'Music211/v4/55/e7/50/55e75082-7e9d-dcd3-ea92-90e76348aa10/191953525228.jpg' },
  { id: 'o-2026-04-03', title: 'Here I Am', type: 'ost', date: '2026-04-03', drama: '신이랑 법률사무소 OST Part 4', artist: '지원', tracks: ['Here I Am'], art: 'Music211/v4/9b/0a/54/9b0a547b-8867-de81-4238-911e151cfc52/888272179125.jpg' },

  // ---- 멤버 개인곡 (OST 제외, 애플 뮤직 크레딧 기준) ----
  { id: 's-2022-03-24', title: 'still love me?', type: 'solo', date: '2022-03-24', drama: 'My Sweden Laundry #2', artist: '하영', tracks: ['still love me?'], art: 'Music112/v4/b7/a7/a6/b7a7a68f-aab7-012d-877b-0ef1d952370e/191953166414.jpg' },
  { id: 's-2023-07-24', title: 'Talk to Me', type: 'solo', date: '2023-07-24', artist: '지원', tracks: ['Talk to Me'], art: 'Music116/v4/5d/05/44/5d05443a-9021-d7ca-42bf-2be46a07c006/cover_KM0017890_1.jpg' },
  { id: 's-2024-10-02', title: 'Stay together all day', type: 'solo', date: '2024-10-02', drama: 'step by together: with U', artist: '하영', tracks: ['Stay together all day'], art: 'Music211/v4/cf/16/75/cf1675cf-ad0d-e0e5-336c-02b4113bc229/888272140835.jpg' },
  { id: 's-2025-08-12', title: 'Sleepless', type: 'solo', date: '2025-08-12', artist: '딘딘 & 하영', tracks: ['Sleepless'], art: 'Music211/v4/a5/08/85/a5088599-9262-a1ed-5bf8-28bbc8519ac7/888272158786.jpg' },
  { id: 's-2026-10-21', title: '처음 그 자리에', ko: 'Where We Began', type: 'solo', date: '2026-10-21', drama: '풀하우스 OST 리메이크', artist: '하영', tracks: ['처음 그 자리에'], art: 'Music211/v4/bc/76/a5/bc76a543-07f5-f973-39fa-a5b622594b07/8800307196367_cover.jpg' },
];
