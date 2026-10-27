export const SCENES = [
  {
    id: "morning",
    step: "아침",
    nurse: "오늘 아침, 이불 밖은 어떠셨어요? 가까운 말 하나를 골라 주세요.",
    choices: [
      {
        id: "heavy-morning",
        text: "눈이 떠져도 이불이 무거워요.",
        label: "무거운 아침",
        tags: { weight: "무거움" },
        encyclopedia: [
          "이불이 사람을 붙드는 아침은, 기운이 아래로 깔리는 쪽에 가깝습니다.",
          "이 말은 무게에 ‘무거움’ 한 표를 줍니다.",
        ],
      },
      {
        id: "sharp-morning",
        text: "자다가도 심장이 먼저 일어나요.",
        label: "먼저 깬 심장",
        tags: { weight: "날카로움" },
        encyclopedia: [
          "잠보다 심장이 먼저 깨면, 하루가 이유보다 빨리 시작합니다.",
          "이 말은 무게에 ‘날카로움’ 한 표를 줍니다.",
        ],
      },
      {
        id: "calm-morning",
        text: "그럭저럭 일어났어요.",
        label: "보통의 아침",
        tags: { weight: "잔잔함" },
        encyclopedia: [
          "큰 파도 없이 일어난 아침도 하나의 대답입니다.",
          "이 말은 무게에 ‘잔잔함’ 한 표를 줍니다.",
        ],
      },
    ],
  },
  {
    id: "people",
    step: "사람들",
    nurse: "사람들 사이에 있을 때, 어디가 먼저 반응했나요?",
    choices: [
      {
        id: "mood-people",
        text: "기분이 가라앉아 말이 줄어요.",
        label: "줄어든 말",
        tags: { place: "기분" },
        encyclopedia: [
          "말이 줄어든 것은 방 안이 아니라, 안의 날씨 때문입니다.",
          "이 말은 자리에 ‘기분’ 한 표를 줍니다.",
        ],
      },
      {
        id: "body-people",
        text: "사람 앞에만 서면 몸이 굳어요.",
        label: "굳는 몸",
        tags: { place: "몸" },
        encyclopedia: [
          "사람 앞에서 어깨와 숨이 생각보다 먼저 굳습니다.",
          "이 말은 자리에 ‘몸’ 한 표를 줍니다.",
        ],
      },
      {
        id: "crowd-people",
        text: "누가 있어도 신경이 쓰여요.",
        label: "신경 쓰이는 자리",
        tags: { place: "사람들" },
        encyclopedia: [
          "사람이 있는 동안 시선이 한곳에 모이지 않습니다.",
          "이 말은 자리에 ‘사람들’ 한 표를 줍니다.",
        ],
      },
    ],
  },
  {
    id: "sudden",
    step: "갑자기",
    nurse: "예고 없이 몸이 먼저 말한 적이 있나요? 병 이름은 적지 않아도 됩니다.",
    choices: [
      {
        id: "sharp-sudden",
        text: "별일 없는데 가슴이 뛰어요.",
        label: "예고 없는 심박",
        tags: { weight: "날카로움", place: "몸" },
        encyclopedia: [
          "이유 없는 가슴뜀은 설명이 도착하기 전에 울립니다.",
          "이 말은 무게 ‘날카로움’, 자리 ‘몸’에 한 표씩 줍니다.",
        ],
      },
      {
        id: "heavy-sudden",
        text: "갑자기 아무것도 하기 싫어져요.",
        label: "뚝 끊긴 힘",
        tags: { weight: "무거움", place: "기분" },
        encyclopedia: [
          "갑자기 하기 싫어지는 것은 게으름의 이름이 아닙니다.",
          "이 말은 무게 ‘무거움’, 자리 ‘기분’에 한 표씩 줍니다.",
        ],
      },
      {
        id: "calm-sudden",
        text: "놀랄 일은 별로 없어요.",
        label: "잠잠한 몸",
        tags: { weight: "잔잔함", place: "고르게" },
        encyclopedia: [
          "놀랄 일이 없는 몸도 기록해 둘 만합니다.",
          "이 말은 무게 ‘잔잔함’, 자리 ‘고르게’에 한 표씩 줍니다.",
        ],
      },
    ],
  },
  {
    id: "night",
    step: "오늘 밤",
    nurse: "오늘 밤, 하루를 어디에 두실 건가요. 가까운 문장 하나만 고르세요.",
    choices: [
      {
        id: "crowd-night",
        text: "사람들이 나간 뒤에도 그 방이 남아 있어요.",
        label: "남은 방",
        tags: { weight: "날카로움", place: "사람들" },
        encyclopedia: [
          "사람들이 나가도 그 공기가 방에 남습니다.",
          "이 말은 무게 ‘날카로움’, 자리 ‘사람들’에 한 표씩 줍니다.",
        ],
      },
      {
        id: "calm-night",
        text: "오늘은 이 정도로 충분해요.",
        label: "충분한 오늘",
        tags: { weight: "잔잔함", place: "고르게" },
        encyclopedia: [
          "이 정도면 충분하다는 밤은 조용한 쪽의 대답입니다.",
          "이 말은 무게 ‘잔잔함’, 자리 ‘고르게’에 한 표씩 줍니다.",
        ],
      },
      {
        id: "crisis-night",
        text: "지금 많이 힘들고, 없어지고 싶어요.",
        crisis: true,
      },
    ],
  },
];

export function findChoice(id) {
  for (const scene of SCENES) {
    const choice = scene.choices.find((item) => item.id === id);
    if (choice) return choice;
  }
  return null;
}
