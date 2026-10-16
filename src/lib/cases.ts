// 분쟁 사례 정적 데이터. 출처: 베이스리서치 01_기술탈취_사례·02_아이디어탈취_사례 (2026.10.16), 바이오·의료 분야만.
// 분쟁 사례 API가 생기면 이 파일 대신 API 응답을 쓴다. 클라이언트·서버 공용(서버 전용 모듈을 import하지 않는다).
import type { DisputeCase } from "./types";

export const DISPUTE_CASES: readonly DisputeCase[] = [
  {
    "id": "peptron-g2gbio",
    "kind": "tech",
    "title": "GLP-1 서방형 미립구 조성물 특허무효심판",
    "plaintiff": "펩트론",
    "defendant": "지투지바이오",
    "domain": "바이오의약(서방형 주사제 제형)",
    "tech": "생분해성 고분자 미립구에 GLP-1 유사체(세마글루타이드 등)를 담은 서방형 주사제 조성물",
    "keywords": [
      "미립구",
      "서방형",
      "GLP-1",
      "세마글루타이드",
      "주사제",
      "생분해성 고분자",
      "microsphere",
      "sustained release",
      "특허무효"
    ],
    "relation": "인력 이동",
    "procedures": [
      "특허 무효심판",
      "특허법원 소송(취하)"
    ],
    "period": {
      "start": "2023.11",
      "end": "2025.1"
    },
    "steps": [
      {
        "date": "2023.11.24",
        "text": "펩트론이 지투지바이오 특허에 특허무효심판을 청구했어요."
      },
      {
        "date": "2024.8",
        "text": "특허심판원이 해당 특허의 등록을 취소하는 심결을 냈어요."
      },
      {
        "date": "2025.1.24",
        "text": "지투지바이오가 심결에 불복해 낸 소송을 스스로 취하했고, 특허가 소멸했다고 보도됐어요."
      },
      {
        "date": "2025.4.30",
        "text": "인벤티지랩이 지투지바이오의 도네페질 서방형 주사제 특허에 무효심판을 청구했어요. 아울바이오도 지투지바이오 특허에 무효심판을 청구했어요."
      }
    ],
    "result": "지투지바이오의 GLP-1 유사체 서방형 미립구 조성물 특허는 소멸했어요. 특허무효심판은 특허의 효력만 다투는 절차여서 손해배상액이나 판매금지 판단은 나오지 않았어요.",
    "reason": "보도에는 특허심판원이 든 무효 사유(신규성, 진보성, 기재요건 등)가 나오지 않아요. 지투지바이오가 심결에 대한 소송을 취하해 특허법원의 판단도 나오지 않았어요.",
    "techImpact": "지투지바이오의 GLP-1 유사체 서방형 미립구 조성물 특허권이 소멸했어요. 이희용 대표는 소 취하 이유로 해당 특허가 지투지바이오가 현재 쓰는 기술을 담고 있지 않다는 점을 들었어요.",
    "bizImpact": "지투지바이오는 2025.8.14 코스닥에 상장했어요. 2025.9.18 종가 기준 시가총액은 약 1조1,429억원으로, 공모가 기준 시가총액 약 3,112억원의 약 4배였어요.",
    "ids": {
      "patents": [
        "제237562호(10-237562-00-00)"
      ],
      "cases": []
    },
    "sources": [
      {
        "label": "팜이데일리 2024.1.15",
        "url": "https://pharm.edaily.co.kr/news/read?mediaCodeNo=257&newsId=01508806638758048"
      },
      {
        "label": "팜이데일리 2025.1.24",
        "url": "https://pharm.edaily.co.kr/News/Read?newsId=02122166642041000"
      },
      {
        "label": "이데일리 2025.5.30",
        "url": "https://v.daum.net/v/20250530090538344"
      },
      {
        "label": "다음뉴스 2025.9.18",
        "url": "https://v.daum.net/v/20250918164348400"
      }
    ]
  },
  {
    "id": "sewon-ubiosis",
    "kind": "tech",
    "title": "아텔로콜라겐 제조공정 영업비밀 침해금지 가처분",
    "plaintiff": "세원셀론텍",
    "defendant": "유바이오시스",
    "domain": "의료기기(콜라겐 재생의료, 의료미용 필러)",
    "tech": "아텔로콜라겐 정제 공정(인산 처리, 염침전, 메쉬 회수, TFF·0.22㎛ 필터 정제)과 이를 쓴 연골 도포재·연부조직 재건재·필러",
    "keywords": [
      "아텔로콜라겐",
      "콜라겐",
      "collagen",
      "정제공정",
      "제조공정",
      "필러",
      "연골",
      "TFF",
      "영업비밀",
      "보호기간"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "영업비밀 침해금지 가처분",
      "항고",
      "재항고"
    ],
    "period": {
      "start": "2018.1",
      "end": "2019.3"
    },
    "steps": [
      {
        "date": "2018.1.5",
        "text": "서울중앙지법이 세원셀론텍의 영업비밀 침해금지 가처분 신청을 기각했어요."
      },
      {
        "date": "2018.10.30",
        "text": "서울고법이 세원셀론텍의 항고와 추가 신청을 기각했어요."
      },
      {
        "date": "2019.3.14",
        "text": "대법원이 세원셀론텍의 재항고를 기각했어요."
      }
    ],
    "result": "법원은 기술파일을 영업비밀로 인정하고 채무자들의 사용도 인정했지만, 영업비밀 보호기간이 지났다는 이유로 생산·판매 금지 신청을 받아들이지 않았어요. 가처분 사건이어서 손해배상액 판단은 없었어요.",
    "reason": "법원은 기술파일 전체가 영업비밀이라고 봤지만, 공정 단계 다수가 세원셀론텍 자신의 특허명세서와 한국·유럽·미국 선행 특허명세서에 이미 공개됐다고 봤어요. 법원은 세원셀론텍 특허가 모두 등록공고된 2015.6.26경 이후 기술정보 대부분이 영업비밀로서의 보호가치를 잃었다고 판단했어요. 대법원은 유출 후 9년이 지난 시점에는 채무자들이 부당하게 얻은 시간상 이점이 이미 사라졌다고 판단했어요.",
    "techImpact": "법원은 유바이오시스의 콜라겐 공정이나 제품에 대한 사용 금지, 폐기 명령을 내리지 않았어요. 세원셀론텍 특허 2건의 명세서 공개는 법원이 기술정보의 보호가치 상실을 판단한 근거가 됐어요.",
    "bizImpact": "법원이 금지 신청을 모두 기각해 유바이오시스 제품의 생산·판매를 막는 명령은 나오지 않았어요.",
    "ids": {
      "patents": [],
      "cases": [
        "서울중앙지법 2017카합80132",
        "서울고법 2018라20045",
        "대법원 2018마7100"
      ]
    },
    "sources": [
      {
        "label": "CaseNote 서울고법 2018라20045",
        "url": "https://casenote.kr/%EC%84%9C%EC%9A%B8%EA%B3%A0%EB%93%B1%EB%B2%95%EC%9B%90/2018%EB%9D%BC20045"
      },
      {
        "label": "로톡 판례 해설",
        "url": "https://www.lawtalk.co.kr/case-lenses/27623"
      }
    ]
  },
  {
    "id": "medytox-daewoong",
    "kind": "tech",
    "title": "보툴리눔 톡신 균주·제조공정 영업비밀 분쟁, 국내 민·형사와 미국 ITC 337-TA-1145",
    "plaintiff": "메디톡스·엘러간",
    "defendant": "대웅제약·에볼루스",
    "domain": "바이오의약, 의료미용(보툴리눔 톡신 제제)",
    "tech": "Clostridium botulinum Hall A-hyper 계열 균주와 900kDa 보툴리눔 톡신 제조공정",
    "keywords": [
      "보툴리눔",
      "톡신",
      "botulinum",
      "균주",
      "제조공정",
      "SNP",
      "Hall A-hyper",
      "나보타",
      "Jeuveau",
      "ITC"
    ],
    "relation": "인력 이동",
    "procedures": [
      "영업비밀 형사",
      "영업비밀 민사",
      "미국 ITC",
      "미국 주법원 소송"
    ],
    "period": {
      "start": "2017.1",
      "end": "진행 중"
    },
    "steps": [
      {
        "date": "2017.1",
        "text": "메디톡스가 대웅제약 등을 산업기술유출방지법·부정경쟁방지법 위반 혐의로 고소했어요."
      },
      {
        "date": "2019.1.30",
        "text": "메디톡스와 엘러간이 대웅제약과 에볼루스를 상대로 ITC에 제소했어요."
      },
      {
        "date": "2020.12.16",
        "text": "ITC 위원회가 최종판정에서 균주의 영업비밀성은 부정하고 제조공정 영업비밀 침해는 유지해, 주보에 21개월 제한적 수입배제명령과 판매·마케팅 중지명령을 내렸어요."
      },
      {
        "date": "2022.2.4",
        "text": "서울중앙지검이 대웅제약 등에 무혐의 처분을 내렸어요."
      },
      {
        "date": "2023.2.10",
        "text": "서울중앙지법이 메디톡스 일부 승소 판결을 내렸어요. 대웅제약은 2023.2.15 항소하고 강제집행정지를 신청했어요."
      },
      {
        "date": "2026.10.8",
        "text": "서울고법이 변론을 종결하고 선고기일을 2027.1.14로 정했어요."
      }
    ],
    "result": "민사 1심 법원은 대웅제약과 지주사 대웅에 총 400억원 배상과 균주 인도, 해당 균주를 쓴 톡신 제제의 제조·판매 금지, 완제품·반제품 폐기를 명했지만, 집행은 강제집행정지로 멈춰 있어요. ITC 최종판정은 2021.10.28 무효화됐고, 에볼루스는 2021.2 합의로 미국 판매를 유지했어요.",
    "reason": "ITC 위원회는 메디톡스 균주의 모균주가 제한 없이 배포됐고 GenBank 서열과 구별하는 SNP가 배양·복제 중 생긴 무작위 돌연변이로 보인다며 균주의 영업비밀성을 부정했지만, 제조공정 영업비밀의 존재와 유용 판단은 유지했어요. 서울중앙지검은 압수수색, 디지털 포렌식, 직원 진술을 종합해도 균주나 제조공정 정보 유출을 인정할 증거가 없다고 봤어요. 민사 1심 법원은 대웅제약 균주가 메디톡스 균주에서 유래했고, 대웅제약 제조공정도 불법 취득한 공정을 바탕으로 개발됐다고 판단했어요.",
    "techImpact": "ITC 최종판정은 메디톡스 균주 자체의 영업비밀성을 부정했고, 수입배제 기간은 제조공정 독자 개발 기간을 기준으로 정해졌어요. 에볼루스는 합의에 따라 2022.9.16~2032.9.16 미국과 미국 외 라이선스 지역 주보 순매출의 한 자릿수 중반(mid-single-digit) %를 메디톡스에 내요.",
    "bizImpact": "에볼루스는 현금 3,500만 달러를 나눠 내고 메디톡스에 보통주 6,762,652주를 발행했고, 메디톡스는 지분 15.5%로 에볼루스 최대주주가 됐어요. 메디톡스의 항소심 청구액 5,001억원은 대웅제약 2026.9.2 공시 기준 자기자본의 44.08%예요.",
    "ids": {
      "patents": [
        "US 9,512,418"
      ],
      "cases": [
        "USITC 337-TA-1145"
      ]
    },
    "sources": [
      {
        "label": "USITC 337-TA-1145 위원회 의견서(공개본)",
        "url": "https://ipwatchdog.com/wp-content/uploads/2024/01/Inv.-1145-Commission-Opinion.pdf"
      },
      {
        "label": "에볼루스 10-K FY2023",
        "url": "https://www.sec.gov/Archives/edgar/data/1570562/000157056224000041/eols-20231231.htm"
      },
      {
        "label": "히트뉴스 2023.2.10",
        "url": "https://www.hitnews.co.kr/news/articleView.html?idxno=43677"
      },
      {
        "label": "이데일리 2026.10.13",
        "url": "https://edaily.co.kr/News/Read?mediaCodeNo=257&newsId=04149206645612592"
      }
    ]
  },
  {
    "id": "changwon-hemophilia",
    "kind": "tech",
    "title": "혈우병A 치료제 유전자 서열·생산세포주 영업비밀 손해배상",
    "plaintiff": "창원 바이오벤처",
    "defendant": "전 연구소장·상무이사 설립사",
    "domain": "바이오의약(혈우병A 치료제 단백질 발현)",
    "tech": "혈우병A 치료제용 유전자 서열 변형과 전달체, 단백질 발현 방식, 생산세포주",
    "keywords": [
      "혈우병",
      "유전자 서열",
      "생산세포주",
      "cell line",
      "단백질 발현",
      "전달체",
      "사철쑥",
      "NCBI",
      "영업비밀"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "영업비밀 민사"
    ],
    "period": {
      "start": "2016.11",
      "end": "2026.9"
    },
    "steps": [
      {
        "date": "2015.3",
        "text": "대표 A씨가 연구소장, 상무이사와 함께 원고 회사를 세웠어요."
      },
      {
        "date": "2016.11",
        "text": "혈우병A 치료제와 생산세포주 연구를 이끈 연구소장과 상무이사가 퇴사했어요."
      },
      {
        "date": "2016.12",
        "text": "두 사람이 새 바이오 기업을 세웠어요."
      },
      {
        "date": "2026.9.11",
        "text": "1심이 원고의 10억원대 손해배상 청구를 모두 기각했고, 청구액을 10억원으로 바꾼 항소도 모두 기각됐다고 보도됐어요."
      }
    ],
    "result": "원고 청구가 1·2심에서 모두 기각돼 배상액은 없어요.",
    "reason": "항소심 법원은 원고 서열과 공개 서열의 차이가 공공 데이터베이스 서열을 복사하는 과정에서 생긴 단순 오류일 뿐 유의미한 기술적 개량이 아니라고 판단했어요. 생산세포주와 사철쑥 추출물 연구도 퇴사 당시 이미 공개된 기술이거나 독립적 경제 가치를 갖춘 영업비밀로 보기 어렵다고 봤어요.",
    "techImpact": "법원은 원고가 주장한 유전자 서열 변형, 생산세포주, 사철쑥 추출물 연구 가운데 어느 것도 영업비밀로 인정하지 않았어요.",
    "bizImpact": "",
    "ids": {
      "patents": [],
      "cases": []
    },
    "sources": [
      {
        "label": "팜뉴스 2026.9.11",
        "url": "https://www.pharmnews.com/news/articleView.html?idxno=306194"
      }
    ]
  },
  {
    "id": "biorad-10x",
    "kind": "tech",
    "title": "미세유체 액적 생성·겔 비드 바코딩 특허 침해와 특허 공동소유 분쟁",
    "plaintiff": "Bio-Rad·University of Chicago",
    "defendant": "10x Genomics",
    "domain": "진단·유전체분석(단일세포 분석)",
    "tech": "미세유체 칩에서의 액적(plug) 생성과 겔 비드 기반 액적 내 바코딩(GEM) 단일세포·유전체 분석",
    "keywords": [
      "microfluidic",
      "미세유체",
      "액적",
      "droplet",
      "겔 비드",
      "바코딩",
      "GEM",
      "단일세포",
      "single cell",
      "균등론"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "특허 침해소송",
      "미국 ITC",
      "CAFC 항소"
    ],
    "period": {
      "start": "2015.2",
      "end": "2021.7"
    },
    "steps": [
      {
        "date": "2015.2",
        "text": "시카고대와 RainDance가 델라웨어 연방지법에 10x를 제소했어요."
      },
      {
        "date": "2018.11",
        "text": "배심원이 특허 3건이 모두 유효하고 10x가 고의로 침해했다고 판단했어요."
      },
      {
        "date": "2019.7.24",
        "text": "법원이 영구 금지명령, 추가 손해배상, 이자를 인용하고 징벌적 증액과 변호사비 청구는 기각했어요."
      },
      {
        "date": "2020.8.3",
        "text": "연방항소법원이 '083 특허 침해와 손해배상 전액을 확정하고, '407·'193 특허는 재심리하도록 환송했어요."
      },
      {
        "date": "2021.4.29",
        "text": "연방항소법원이 ITC 337-TA-1100 사건에서 Bio-Rad가 10x 특허 3건을 침해했다는 판단과 Bio-Rad의 공동소유 항변 기각을 확정했어요."
      },
      {
        "date": "2021.7.26",
        "text": "두 회사가 합의서에 서명했고, 2021.7.27 합의를 발표했어요."
      }
    ],
    "result": "법원이 2019.7.24 내린 최종 판결액은 추가 손해배상과 이자를 포함해 3,447만 5,069달러예요. 두 회사는 2021.7 모든 관할의 소송을 다시 제기할 수 없는 조건(with prejudice)으로 취하하고 단일세포 분야 상호 라이선스를 맺었어요.",
    "reason": "배심원은 0.02% Kynar가 든 10x 미세채널이 '비불소화 미세채널'을 균등론으로 충족한다고 판단했고, 연방항소법원은 출원 경과 금반언이 적용되지 않는다고 봤어요. 공동소유 항변에서 연방항소법원은 양도 조항이 재직 기간으로 한정돼 있어, 퇴사 전에 그 자체로 지식재산으로 보호될 수 있는 대상에만 양도 의무가 생긴다고 해석했어요.",
    "techImpact": "10x가 제소 뒤 미세채널에 0.02% Kynar를 넣은 변경은 균등론 침해 판단을 피하지 못했어요. 연방항소법원 판결로 '407·'193 특허 청구항의 범위는 칩 안 반응으로 좁게 해석됐어요.",
    "bizImpact": "연방항소법원 판결문에는 Single Cell 3' 제품이 10x 매출의 80% 이상이라는 10x의 인정 사항이 Bio-Rad 주장으로 인용돼 있어요. 10x는 2019.9.12 Nasdaq(TXG)에 공모가 39달러로 상장했어요.",
    "ids": {
      "patents": [
        "US 8,889,083",
        "US 8,304,193",
        "US 8,329,407",
        "US 9,689,024",
        "US 9,695,468",
        "US 9,856,530",
        "US 9,500,664",
        "US 9,636,682",
        "US 9,649,635",
        "US 7,294,503(선행특허 Quake)"
      ],
      "cases": [
        "D. Del. 1:15-cv-00152-RGA",
        "D. Del. 1:19-cv-01699",
        "CAFC 2019-2255",
        "CAFC 2019-2285",
        "USITC 337-TA-1100",
        "CAFC 2020-1785",
        "USITC 337-TA-1068",
        "CAFC 2020-1475",
        "CAFC 2020-1605"
      ]
    },
    "sources": [
      {
        "label": "CAFC 2019-2255 판결",
        "url": "https://www.finnegan.com/images/content/3/1/v2/313888/19-2255.OPINION.8-3-2020-1629496.pdf"
      },
      {
        "label": "CAFC 2020-1785 판결",
        "url": "https://www.finnegan.com/a/web/8hk7DWuDziFgokQh6JTyME/2Gmarq/201785_bioradlaboratories_v_internationaltradecommission.pdf"
      },
      {
        "label": "Knobbe Martens",
        "url": "https://www.knobbe.com/blog/court-enters-permanent-injunction-and-34-million-judgment-bio-rad-against-10x-genomics/"
      },
      {
        "label": "10x 8-K 2021.7.26",
        "url": "https://www.sec.gov/Archives/edgar/data/1770787/000177078721000039/txg-20210726.htm"
      }
    ]
  },
  {
    "id": "masimo-truewearables",
    "kind": "tech",
    "title": "비침습 헤모글로빈 측정 알고리즘 영업비밀 분쟁",
    "plaintiff": "Masimo·Cercacor",
    "defendant": "True Wearables·Marcelo Lamego",
    "domain": "의료기기(비침습 생체신호 측정), 디지털헬스",
    "tech": "광흡수 측정값으로 총 헤모글로빈 농도(SpHb)를 계산하는 식의 계수 최적화 알고리즘(TSS)과 웨어러블 맥박산소측정기",
    "keywords": [
      "SpHb",
      "헤모글로빈",
      "비침습",
      "맥박산소측정기",
      "pulse oximeter",
      "알고리즘",
      "웨어러블",
      "TSS",
      "Oxxiom",
      "영업비밀"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "영업비밀 민사",
      "예비 금지명령",
      "CAFC 항소"
    ],
    "period": {
      "start": "2021.1",
      "end": "2022.11"
    },
    "steps": [
      {
        "date": "2021.1.11",
        "text": "미국 특허청이 True Wearables 출원 16/198,335에 등록 결정 통지를 내자, Masimo가 가출원 62/591,158의 공개를 막으려고 예비 금지명령을 신청했고 연방지법이 받아들였어요."
      },
      {
        "date": "2022.1.24",
        "text": "연방항소법원이 비선례 판결로 예비 금지명령을 유지했어요."
      },
      {
        "date": "2022.11.17",
        "text": "Masimo가 연방지법의 본안 판단 내용을 발표했어요."
      }
    ],
    "result": "법원은 Lamego가 Masimo의 영업비밀을 유용했고 Cercacor에 대한 충실의무와 고용계약을 위반했다고 판단했어요. 법원은 True Wearables가 Oxxiom을 \"영업비밀을 포함한 현 형태\"로 판매하는 것을 영구 금지하고, 영업비밀이 담긴 특허출원 최소 12건을 포기하라고 명령했어요.",
    "reason": "연방지법은 IEEE 논문이 잘 알려진 문헌이기는 하지만, 그것만으로 그 기법이 비침습 혈액성분 측정기를 개발해 경제적 가치를 얻을 수 있는 사람들에게 일반적으로 알려져 있었다고 볼 수는 없다고 봤어요. 연방항소법원은 Lamego 자신이 TSS를 \"문헌에 알려지지 않은 영업비밀\"이라고 이메일에 적었고, 기록장에 영업비밀 표시를 했으며, 특허청에 TSS가 \"통상의 지식\"이 아니라고 주장한 점을 증거로 들었어요.",
    "techImpact": "True Wearables는 영업비밀이 담긴 특허출원 최소 12건을 Masimo나 Cercacor에 이전하는 대신 포기하라는 명령을 받았어요. Oxxiom은 영업비밀을 포함한 현 형태로는 판매할 수 없게 됐어요.",
    "bizImpact": "Masimo 주가는 판결 발표 당일 3.8% 올라 137.43달러를 기록했어요.",
    "ids": {
      "patents": [
        "US 16/198,335(출원)",
        "US 62/591,158(가출원)"
      ],
      "cases": [
        "C.D. Cal. SACV 18-2001 JVS(8:18-cv-02001)",
        "CAFC 2021-2146"
      ]
    },
    "sources": [
      {
        "label": "CAFC 2021-2146 판결",
        "url": "https://www.cafc.uscourts.gov/opinions-orders/21-2146.OPINION.1-24-2022_1897012.pdf"
      },
      {
        "label": "OCBJ",
        "url": "https://www.ocbj.com/manufacturing/masimo-wins-ruling-vs-apple-ex-employee/"
      },
      {
        "label": "Business Wire",
        "url": "https://www.businesswire.com/news/home/20221117005436/en"
      },
      {
        "label": "Bloomberg Law",
        "url": "https://news.bloomberglaw.com/ip-law/masimo-wins-ruling-on-former-executives-theft-of-trade-secrets"
      }
    ]
  },
  {
    "id": "alnylam-dicerna",
    "kind": "tech",
    "title": "RNAi GalNAc 접합체 기술 영업비밀 분쟁",
    "plaintiff": "Alnylam",
    "defendant": "Dicerna",
    "domain": "바이오의약(RNAi 치료제)",
    "tech": "RNAi 치료제의 간세포 전달용 GalNAc(N-아세틸갈락토사민) 접합체 기술",
    "keywords": [
      "RNAi",
      "GalNAc",
      "접합체",
      "conjugate",
      "간세포 전달",
      "올리고뉴클레오타이드",
      "영업비밀",
      "반독점"
    ],
    "relation": "인력 이동",
    "procedures": [
      "영업비밀 민사",
      "반소",
      "반독점 소송"
    ],
    "period": {
      "start": "2015.6",
      "end": "2018.4"
    },
    "steps": [
      {
        "date": "2015.6.10",
        "text": "Alnylam이 매사추세츠주 Middlesex 카운티 상급법원에 Dicerna를 제소하고 영구 금지명령과 손해배상을 청구했어요."
      },
      {
        "date": "2017.8",
        "text": "Dicerna가 소송 남용·영업 방해 반소를 추가하고, 매사추세츠 연방지법에 셔먼법 위반(독점 시도)을 이유로 Alnylam을 제소했어요."
      },
      {
        "date": "2017.9",
        "text": "Alnylam이 반소 각하를 신청했고 법원은 이를 기각했어요."
      },
      {
        "date": "2018.4.18",
        "text": "두 회사가 2018.4.23로 잡힌 배심 재판을 앞두고 합의서에 서명했고, 2018.4.20 합의를 발표했어요."
      }
    ],
    "result": "Dicerna는 선급금 200만 달러와 보통주 983,208주를 지급하고 추가로 1,300만 달러를 내기로 했고, 잔여액은 2018.12와 2019.1에 앞당겨 완납했어요. 두 회사는 모든 청구와 반소를 다시 제기할 수 없는 조건으로 취하했고, 어느 쪽도 책임을 인정하지 않았어요.",
    "reason": "사건이 재판 전 합의로 끝나 법원은 GalNAc 접합체 정보의 영업비밀성이나 유용 여부를 판단하지 않았어요.",
    "techImpact": "Dicerna는 정해진 타깃군에 대한 올리고뉴클레오타이드 치료제 개발과 관련 활동을 18개월~4년 동안 제한받았어요. 합의에는 Alnylam의 GalNAc 접합체 지식재산에 대한 라이선스가 포함되지 않았어요.",
    "bizImpact": "Novo Nordisk는 2021.11.18 Dicerna 인수를 발표했고, 주당 38.25달러 현금 공개매수를 거쳐 2021.12.28 인수를 마쳤어요.",
    "ids": {
      "patents": [],
      "cases": [
        "Massachusetts Superior Court(Middlesex) No. 15-4126",
        "D. Mass. 1:17-cv-11466"
      ]
    },
    "sources": [
      {
        "label": "Alnylam 10-K FY2018",
        "url": "https://www.sec.gov/Archives/edgar/data/1178670/000156459019003022/alny-10k_20181231.htm"
      },
      {
        "label": "BioPharma Dive",
        "url": "https://www.biopharmadive.com/news/alnylam-dicerna-settle-rnai-trade-secrets-lawsuit/521888/"
      },
      {
        "label": "Dicerna 보도자료 2018.4.20",
        "url": "https://www.businesswire.com/news/home/20180420005589/en/Dicerna-Pharmaceuticals-Announces-Settlement-Litigation-Alnylam"
      },
      {
        "label": "Novo Nordisk",
        "url": "https://www.novonordisk.com/news-and-media/news-and-ir-materials/news-details.html?id=93736"
      }
    ]
  },
  {
    "id": "genentech-jhl",
    "kind": "tech",
    "title": "바이오시밀러 분석법·공정 문서 영업비밀 민사·형사 사건",
    "plaintiff": "Genentech",
    "defendant": "JHL Biotech",
    "domain": "바이오의약(바이오시밀러)",
    "tech": "Pulmozyme, Rituxan, Herceptin, Avastin의 분석법, 제형, 세포배양·회수 공정 문서와 바이오시밀러용 세포주",
    "keywords": [
      "바이오시밀러",
      "biosimilar",
      "분석법",
      "세포배양",
      "세포주",
      "cell line",
      "제형",
      "Herceptin",
      "Avastin",
      "Rituxan"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "영업비밀 민사",
      "예비 금지명령",
      "영업비밀 형사"
    ],
    "period": {
      "start": "2018.10",
      "end": "2022.3"
    },
    "steps": [
      {
        "date": "2018.10.29",
        "text": "Genentech가 캘리포니아 북부 연방지법에 JHL과 전 Genentech 직원 등을 상대로 민사소송을 냈어요."
      },
      {
        "date": "2019",
        "text": "법원이 예비 금지명령을 내렸어요."
      },
      {
        "date": "2019.9.5",
        "text": "JHL이 Genentech와의 민사 합의를 발표했어요."
      },
      {
        "date": "2021.6",
        "text": "검찰이 Jordanov와 Lin을 공모, 영업비밀 절취, 전신사기, 국제 자금세탁, 사법방해 혐의로 기소했어요."
      },
      {
        "date": "2021.8",
        "text": "Jordanov와 Lin이 영업비밀 절취 공모와 전신사기 혐의에 대해 유죄를 인정했어요."
      },
      {
        "date": "2022.3.15",
        "text": "Alsup 판사가 Jordanov와 Lin에게 형을 선고했어요."
      }
    ],
    "result": "민사에서 JHL은 합의서에 명시된 제품의 개발과 임상을 중단하고 관련 세포주와 세포은행을 폐기하기로 했고, 그 밖의 손해배상은 없어요. 형사에서 Jordanov와 Lin은 각각 징역 12개월 1일과 보호관찰 36개월을 선고받았고, Jordanov에게는 가택구금 9개월이 더해졌어요.",
    "reason": "민사는 2019년 예비 금지명령 뒤 합의로, 형사는 피고인들의 유죄 인정으로 끝나 각 문서의 영업비밀성을 다룬 본안 판결은 나오지 않았어요. 기소장은 Genentech가 이 절차·분석법과 노하우를 개발하는 데 최소 1억 2,000만 달러를 썼다고 적었어요.",
    "techImpact": "JHL은 약 6년 동안 개발해 온 Pulmozyme, Rituxan, Herceptin, Avastin 바이오시밀러 4종의 개발을 중단하고 세포주를 폐기하기로 했어요. JHL은 세포은행 폐기에 대해 Genentech의 감사를 받기로 했어요.",
    "bizImpact": "기소장은 영업비밀 유용 의혹이 공개된 뒤 JHL의 가치가 폭락해 투자자와 전략적 파트너가 수억 달러의 손실을 입었다고 적었어요. JHL은 2021년 사명을 Eden Biologics로 바꿨고, 이후 CDMO 사업 자산 매각을 마쳤다고 발표했어요.",
    "ids": {
      "patents": [],
      "cases": [
        "N.D. Cal. 18-cv-06582 WHA",
        "N.D. Cal. CR 21-0227"
      ]
    },
    "sources": [
      {
        "label": "DOJ 기소장",
        "url": "https://www.justice.gov/usao-ndca/press-release/file/1409851/dl"
      },
      {
        "label": "Big Molecule Watch",
        "url": "https://www.bigmoleculewatch.com/2019/09/06/settlement-reached-in-genentech-v-jhl-biosimilar-trade-secrets-case/"
      },
      {
        "label": "Center for Biosimilars",
        "url": "https://centerforbiosimilars.com/view/in-agreement-with-genentech-jhl-must-destroy-its-biosimilar-cell-lines-and-banks"
      },
      {
        "label": "Goodwin",
        "url": "https://www.goodwinlaw.com/en/insights/blogs/2022/03/jhl-biotech-co-founders-sentenced-to-jail-for-theft-of-trade-secrets"
      }
    ]
  },
  {
    "id": "hologic-minerva",
    "kind": "tech",
    "title": "자궁내막 절제 기기 특허 침해와 양도인 금반언 분쟁",
    "plaintiff": "Hologic",
    "defendant": "Minerva Surgical",
    "domain": "의료기기(부인과 절제 기기)",
    "tech": "자궁내막 절제 기기의 어플리케이터 헤드·전극 어레이 구조와 절제 중 자궁 천공 감지 방법",
    "keywords": [
      "자궁내막 절제",
      "endometrial ablation",
      "어플리케이터 헤드",
      "전극",
      "천공 감지",
      "양도인 금반언",
      "assignor estoppel",
      "NovaSure",
      "IPR"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "특허 침해소송",
      "PTAB",
      "CAFC 항소",
      "연방대법원"
    ],
    "period": {
      "start": "2015.11",
      "end": "2022.8"
    },
    "steps": [
      {
        "date": "2015.11",
        "text": "Hologic이 델라웨어 연방지법에 Minerva를 제소했어요."
      },
      {
        "date": "2017.10.5",
        "text": "PTAB가 IPR2016-00868에서 '183 특허 청구항이 자명하다고 판단했어요."
      },
      {
        "date": "2019.4.19",
        "text": "연방항소법원이 '183 특허에 대한 PTAB 판단을 유지했어요."
      },
      {
        "date": "2021.6.29",
        "text": "연방대법원이 5대4로 양도인 금반언 원칙을 유지하되, 양도 때 한 표시와 모순되는 무효 주장에만 적용된다고 범위를 좁히고 사건을 환송했어요."
      },
      {
        "date": "2022.8.11",
        "text": "연방항소법원이 '348 특허 청구항 1에 금반언 적용을 유지하고 Minerva에 대한 침해 판결을 복원했어요."
      }
    ],
    "result": "배심원은 약 480만 달러 배상을 평결했고, 손해배상은 추가 손해배상과 이자를 더해 약 740만 달러로 두 번째 특허가 만료된 2018.11까지의 판매분에 한정됐어요. 법원은 Hologic의 영구 금지명령 신청을 기각했어요.",
    "reason": "연방대법원은 새 청구항이 발명자가 양도한 청구항보다 실질적으로 넓으면 발명자가 그 유효성을 보증했다고 볼 수 없어 금반언이 적용되지 않는다고 봤어요. 연방항소법원은 원출원 청구항 31에 수분 투과성 요건이 없으므로 '348 특허 청구항 1이 양도된 청구항보다 실질적으로 넓지 않다고 보고, Minerva가 그 유효성을 다툴 수 없다고 결론 냈어요. '183 특허는 선행기술의 압력 감시·누출 경보 개시를 근거로 한 PTAB의 자명성 판단이 유지됐어요.",
    "techImpact": "'183 특허의 천공 감지 방법 청구항은 IPR에서 특허받을 수 없다는 판단을 받았어요. '348 특허의 '어플리케이터 헤드'는 수분 투과성과 불투과성 구조를 모두 포함하는 것으로 해석됐어요.",
    "bizImpact": "Minerva는 2021.10 공모가 12달러로 Nasdaq(UTRS)에 상장했고, 2023.12.15 비용 절감을 이유로 자진 상장폐지와 SEC 등록 해지 계획을 발표했어요.",
    "ids": {
      "patents": [
        "US 9,095,348",
        "US 6,872,183",
        "US 09/103,072(US 6,813,520)"
      ],
      "cases": [
        "IPR2016-00868",
        "CAFC 2018-1550",
        "CAFC 19-2054",
        "연방대법원 20-440"
      ]
    },
    "sources": [
      {
        "label": "CAFC 19-2054 판결",
        "url": "https://fedcircuitblog.com/wp-content/uploads/2022/09/19-2054-Opinion.pdf"
      },
      {
        "label": "CAFC 2018-1550 판결",
        "url": "https://www.cafc.uscourts.gov/opinions-orders/18-1550.opinion.4-19-2019.pdf"
      },
      {
        "label": "AIPLA",
        "url": "https://aipla.org/detail/news/2021/06/29/supreme-court-rules-to-keep-the-doctrine-of-assignor-estoppel-in-minerva-v.-hologic"
      },
      {
        "label": "Minerva 10-Q 2022년 3분기",
        "url": "https://www.sec.gov/Archives/edgar/data/1452965/000095017022025028/utrs-20220930.htm"
      }
    ]
  },
  {
    "id": "angioscore-trireme",
    "kind": "tech",
    "title": "혈관성형 풍선카테터 신인의무·특허 분쟁",
    "plaintiff": "AngioScore",
    "defendant": "TriReme Medical·Eitan Konstantino",
    "domain": "의료기기(말초혈관 중재시술)",
    "tech": "혈관성형(PTA) 풍선카테터(AngioScore의 AngioSculpt, TriReme의 Chocolate)",
    "keywords": [
      "풍선카테터",
      "balloon catheter",
      "혈관성형",
      "PTA",
      "신인의무",
      "fiduciary duty",
      "회사기회",
      "Chocolate",
      "AngioSculpt"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "특허 침해소송",
      "신인의무 위반 청구",
      "CAFC 항소"
    ],
    "period": {
      "start": "2012.6",
      "end": "2016.7"
    },
    "steps": [
      {
        "date": "2012.6.29",
        "text": "AngioScore가 캘리포니아 북부 연방지법에 '119 특허 침해 소송을 냈고, 이후 신인의무 위반, 방조, 불공정경쟁 등 주법 청구를 추가했어요."
      },
      {
        "date": "2015.7.1",
        "text": "연방지법이 주법 청구에 대한 벤치 판결에서 Konstantino의 신인의무 위반을 인정했어요."
      },
      {
        "date": "2015.9",
        "text": "배심원이 Chocolate이 '119 특허의 주장 청구항을 침해하지 않고, 주장 청구항이 모두 선행기술에 비춰 자명해 무효라고 평결했어요."
      },
      {
        "date": "2016.7.21",
        "text": "연방항소법원이 주법 청구에 대한 보충관할이 성립하지 않는다며 약 2,000만 달러 판결을 취소하고 환송했어요."
      }
    ],
    "result": "2015.7.1 판결은 피고들이 연대해 일실이익 2,003만 4,000달러를 배상하도록 했지만, 연방항소법원이 2016.7.21 이 주법 청구 판결을 취소했어요. 특허 청구는 배심 평결에 따라 피고 승소로 끝났어요.",
    "reason": "연방지법은 AngioSculpt와 Chocolate이 모두 병변 부위에서 풍선을 부풀려 막힌 혈관을 여는 혈관성형 풍선카테터라는 점 등을 근거로 Chocolate이 AngioScore의 사업 영역에 속하는 회사기회라고 판단했어요. 연방항소법원은 특허 청구와 회사기회 청구 사이에 공통의 사실관계가 없다고 봤어요.",
    "techImpact": "'119 특허의 주장 청구항은 배심 평결에서 자명성을 이유로 무효로 판단됐어요. Chocolate 판매금지 청구가 기각돼 TriReme은 Chocolate 판매를 이어갔어요.",
    "bizImpact": "TriReme의 모회사 QT Vascular(SGX 상장)는 배심 평결 뒤 특허 청구와 관련한 책임이 생기지 않을 것으로 예상한다고 밝혔고, 2016.7 연방항소법원의 판결 파기를 SGX에 공시했어요.",
    "ids": {
      "patents": [
        "US 7,691,119"
      ],
      "cases": [
        "N.D. Cal. 4:12-cv-03393-YGR",
        "CAFC 2016-1126",
        "CAFC 2016-1142"
      ]
    },
    "sources": [
      {
        "label": "CAFC 2016-1126 판결",
        "url": "https://cafc.uscourts.gov/opinions-orders/16-1126.opinion.7-18-2016.1.pdf"
      },
      {
        "label": "QT Vascular 보도자료 2015.9.30",
        "url": "https://edbi.com/wp-content/uploads/2021/08/qtv_pr_30092015.pdf"
      },
      {
        "label": "CLS Blue Sky",
        "url": "http://clsbluesky.law.columbia.edu/2015/07/13/when-fiduciary-duties-and-entrepreneurial-innovation-collide-angioscore-v-trireme-2/"
      },
      {
        "label": "MassDevice",
        "url": "https://www.massdevice.com/spectranetics-angioscore-wins-20m-from-trireme-founder-konstantino/"
      }
    ]
  },
  {
    "id": "intuitive-auris",
    "kind": "tech",
    "title": "수술 로봇 특허 침해와 IPR 분쟁",
    "plaintiff": "Intuitive Surgical",
    "defendant": "Auris Health",
    "domain": "의료기기(수술 로봇)",
    "tech": "로봇 수술 시스템(수술기구 교체용 서보 풀리 기구 등)",
    "keywords": [
      "수술 로봇",
      "surgical robot",
      "로봇 수술",
      "서보 풀리",
      "수술기구 교체",
      "자명성",
      "결합 동기",
      "IPR"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "특허 침해소송",
      "PTAB",
      "CAFC 항소"
    ],
    "period": {
      "start": "2018",
      "end": "2023.8"
    },
    "steps": [
      {
        "date": "2018",
        "text": "Intuitive가 델라웨어 연방지법에 Auris를 제소했어요."
      },
      {
        "date": "2020.4",
        "text": "Auris 대리인 Sidley에 따르면 PTAB가 Intuitive 특허 2건에 불리한 판정을 내렸어요."
      },
      {
        "date": "2020.12",
        "text": "PTAB가 다른 Intuitive 특허 1건의 18개 청구항을 전부 무효로 판정했어요."
      },
      {
        "date": "2022.3.14",
        "text": "연방항소법원이 18개 청구항 무효 판정을 유지했어요."
      },
      {
        "date": "2022.4.29",
        "text": "연방항소법원이 '447 특허 IPR에서 Auris의 자명성 주장을 받아들이지 않은 PTAB 판정을 취소하고 환송했어요."
      },
      {
        "date": "2023.8.8",
        "text": "두 회사가 합의로 소송을 끝냈어요."
      }
    ],
    "result": "Intuitive 특허 1건은 PTAB에서 18개 청구항 전부 무효 판정을 받았고, 연방항소법원이 이 판정을 유지했어요. 두 회사는 2023.8.8 합의로 소송을 종결했고, 합의 조건은 공개되지 않았어요.",
    "reason": "PTAB는 당시 외과의들이 로봇 수술 전반에 회의적이었으므로 Smith 시스템에 Faraz의 로봇 지지대를 결합할 동기가 없었다고 판단했어요. 연방항소법원은 업계 전반의 일반적 회의론만으로는 결합 동기를 부정할 수 없고, 특정 선행기술 결합에 대한 구체적 회의론이어야 고려할 수 있다고 판단했어요.",
    "techImpact": "Intuitive 특허 1건의 청구항 18개가 무효로 확정됐고, '447 특허의 자명성 판단은 PTAB로 돌아갔어요.",
    "bizImpact": "J&J는 소송 중이던 2019년 Auris를 현금 34억 달러와 최대 23억 5,000만 달러의 마일스톤 조건으로 인수했어요. 델라웨어 형평법원은 2024.9 마일스톤 미지급 소송에서 J&J에 10억 달러 이상을 배상하라고 판결했어요.",
    "ids": {
      "patents": [
        "US 8,142,447"
      ],
      "cases": [
        "D. Del. 1:18-cv-01359",
        "CAFC 2021-1732"
      ]
    },
    "sources": [
      {
        "label": "Sidley",
        "url": "https://www.sidley.com/en/newslanding/newsannouncements/2022/05/sidley-obtains-trio-of-wins-and-precedential-federal-circuit-victory-on-behalf-of-auris-health-inc"
      },
      {
        "label": "A&O Shearman",
        "url": "https://www.lit-ip.aoshearman.com/Federal-Circuit-Vacates-PTAB-Determination-That-Claims-Were-Not-Obvious"
      },
      {
        "label": "TechCrunch 2019.2.13",
        "url": "https://techcrunch.com/2019/02/13/jj-spends-3-4-billion-in-cash-for-auris-healths-lung-cancer-diagnostics-and-surgical-robots"
      },
      {
        "label": "Law360",
        "url": "https://www.law360.com/articles/1709151"
      }
    ]
  },
  {
    "id": "agilent-twist",
    "kind": "tech",
    "title": "올리고뉴클레오타이드 합성 기술 영업비밀 분쟁",
    "plaintiff": "Agilent Technologies",
    "defendant": "Twist Bioscience",
    "domain": "유전체·DNA 합성",
    "tech": "올리고뉴클레오타이드(올리고) 합성 기술",
    "keywords": [
      "올리고뉴클레오타이드",
      "oligonucleotide",
      "올리고 합성",
      "DNA 합성",
      "DNA synthesis",
      "영업비밀",
      "문서 반출",
      "충실의무"
    ],
    "relation": "전 직원 창업",
    "procedures": [
      "영업비밀 민사"
    ],
    "period": {
      "start": "2016.2",
      "end": "2020.2"
    },
    "steps": [
      {
        "date": "2016.2.3",
        "text": "Agilent가 산타클라라 카운티 상급법원에 Twist를 제소했어요."
      },
      {
        "date": "2018.9.17",
        "text": "Agilent가 Agilent 출신 인력이 \"Confidential\" 표시가 된 문서 수백 건을 가져갔다는 주장을 담은 새 소장을 냈다고 발표했어요."
      },
      {
        "date": "2018.12",
        "text": "Agilent가 Siyuan Chen과 Solange Glaize를 피고로 추가했어요."
      },
      {
        "date": "2020.2.6",
        "text": "두 회사가 2020.2.24로 지정된 재판일을 앞두고 합의했어요."
      }
    ],
    "result": "Twist는 14일 안에 Agilent에 현금 2,250만 달러를 지급하기로 했어요. 어느 쪽도 책임을 인정하지 않았어요.",
    "reason": "사건이 재판 전 합의로 끝나 법원은 올리고 합성 기술의 영업비밀성이나 유용 여부를 판단하지 않았어요.",
    "techImpact": "Agilent는 Twist에 Agilent 올리고 합성 기술 일부의 실시권을 줬어요. Agilent는 소송에서 주장한 영업비밀을 청구하는 Agilent 특허로 Twist를 제소하지 않기로 약정했어요.",
    "bizImpact": "Twist는 소송 중이던 2018.10.30 공모가를 희망 범위(14~16달러) 하단인 14달러로 정하고 500만 주로 7,000만 달러를 조달했어요.",
    "ids": {
      "patents": [],
      "cases": [
        "Santa Clara County Superior Court 16-cv-291137"
      ]
    },
    "sources": [
      {
        "label": "Twist 10-K FY2019",
        "url": "https://www.sec.gov/Archives/edgar/data/1581280/000119312519313115/d65251d10k.htm"
      },
      {
        "label": "Agilent 보도자료 2018.9.17",
        "url": "https://www.agilent.com.cn/about/newsroom/presrel/2018/18sep-gp18053.html"
      },
      {
        "label": "Agilent 보도자료 2020.2",
        "url": "https://www.investor.agilent.com/news-and-events/news/news-details/2020/Agilent-Technologies-Announces-Twist-Bioscience-Agrees-to-Pay-225-Million-Settlement-in-IP-Litigation/default.aspx"
      },
      {
        "label": "Twist 10-Q 2019.12 분기",
        "url": "https://www.sec.gov/Archives/edgar/data/1581280/000119312520029990/d856903d10q.htm"
      }
    ]
  },
  {
    "id": "amgen-coherus",
    "kind": "tech",
    "title": "페그필그라스팀 바이오시밀러 영업비밀·정제공정 특허 분쟁",
    "plaintiff": "Amgen",
    "defendant": "Coherus BioSciences",
    "domain": "바이오의약(바이오시밀러)",
    "tech": "페그필그라스팀(Amgen Neulasta) 바이오시밀러의 제조·분석 정보와 소수성 상호작용 크로마토그래피(HIC) 단백질 정제공정",
    "keywords": [
      "페그필그라스팀",
      "pegfilgrastim",
      "바이오시밀러",
      "HIC",
      "크로마토그래피",
      "정제공정",
      "염 조합",
      "출원 경과 금반언",
      "Udenyca",
      "Neulasta"
    ],
    "relation": "인력 이동",
    "procedures": [
      "영업비밀 민사",
      "특허 침해소송",
      "CAFC 항소"
    ],
    "period": {
      "start": "2017.3",
      "end": "2019.7"
    },
    "steps": [
      {
        "date": "2017.3",
        "text": "Amgen이 캘리포니아 벤추라 카운티 주법원에 영업비밀 소송을 냈어요."
      },
      {
        "date": "2017.5.10",
        "text": "Amgen이 Coherus의 aBLA를 근거로 델라웨어 연방지법에 '707 특허 침해 소송을 냈어요."
      },
      {
        "date": "2017.12.7",
        "text": "치안판사가 출원 경과 금반언을 이유로 소장 각하를 권고했고, 지법이 이를 채택해 특허 침해 소장을 각하했어요."
      },
      {
        "date": "2018.11.2",
        "text": "FDA가 Udenyca를 승인했고, Coherus는 2019.1 Udenyca를 출시했어요."
      },
      {
        "date": "2019.5.2",
        "text": "두 회사가 영업비밀 사건을 합의로 끝냈어요."
      },
      {
        "date": "2019.7.29",
        "text": "연방항소법원이 '707 특허 소송 각하를 유지했어요."
      }
    ],
    "result": "영업비밀 사건에서 Coherus는 Udenyca 판매를 계속하고, Amgen에 5년간 한 자릿수 중반(mid-single-digit) 비율의 로열티를 지급해요. 특허 사건에서는 Amgen의 균등침해 주장이 출원 경과 금반언으로 막혀 각하가 확정됐어요.",
    "reason": "영업비밀 사건은 합의로 끝나 법원이 문서의 영업비밀성이나 유용 여부를 판단하지 않았어요. 연방항소법원은 Amgen이 심사 중 선행특허 Holtz가 \"청구된 특정 염 조합\"을 개시하지 않는다고 반복해 주장해, 청구된 세 조합 밖의 염 조합을 명확하게 포기했다고 판단했어요.",
    "techImpact": "Coherus aBLA에 적힌 제조공정은 청구된 세 조합과 다른 염 조합의 크로마토그래피 완충액을 썼고, Coherus는 '707 특허 사건에서 이 공정에 대한 침해 책임을 지지 않았어요.",
    "bizImpact": "Coherus는 소송 중에 FDA 승인을 받아 Udenyca를 출시했고, 합의 뒤에도 판매를 이어갔어요.",
    "ids": {
      "patents": [
        "US 8,273,707",
        "US 5,231,178(선행특허 Holtz)"
      ],
      "cases": [
        "D. Del. 1:17-cv-00546-LPS",
        "CAFC 2018-1993"
      ]
    },
    "sources": [
      {
        "label": "CAFC 2018-1993 판결",
        "url": "https://cafc.uscourts.gov/opinions-orders/18-1993.opinion.7-29-2019.pdf"
      },
      {
        "label": "Center for Biosimilars",
        "url": "https://www.centerforbiosimilars.com/view/amgen-lawsuit-against-coherus-alleges-misappropriation-of-neulasta-trade-secrets-"
      },
      {
        "label": "Amgen 성명",
        "url": "https://www.amgen.com/media/our-perspective/amgen-reaches-settlement-with-coherus-in-trade-secrets-case-regarding-pegfilgrastim"
      },
      {
        "label": "Goodwin",
        "url": "https://www.goodwinlaw.com/en/insights/blogs/2019/05/coherus-udenyca-update-trade-secret-case-settled-bpcia-appeal-argued"
      }
    ]
  },
  {
    "id": "cardiaq-neovasc",
    "kind": "tech",
    "title": "경도관 승모판막 영업비밀·공동발명자 분쟁",
    "plaintiff": "CardiAQ Valve Technologies",
    "defendant": "Neovasc",
    "domain": "의료기기(구조적 심장질환, 경도관 판막)",
    "tech": "경도관 승모판막 치환(TMVR) 임플란트의 금속 프레임 설계, 판막 조립용 맨드릴, 개발 이력",
    "keywords": [
      "승모판막",
      "TMVR",
      "경도관",
      "판막",
      "맨드릴",
      "공동발명자",
      "발명자 정정",
      "Tiara",
      "영업비밀",
      "용역"
    ],
    "relation": "협력·위탁",
    "procedures": [
      "영업비밀 민사",
      "발명자 정정",
      "CAFC 항소"
    ],
    "period": {
      "start": "2014",
      "end": "2019.4"
    },
    "steps": [
      {
        "date": "2014",
        "text": "CardiAQ가 매사추세츠 연방지법에 Neovasc를 제소했어요."
      },
      {
        "date": "2016.5.19",
        "text": "배심원이 Neovasc의 계약 위반과 영업비밀 6건 중 3건의 유용을 인정했어요."
      },
      {
        "date": "2016.10.31",
        "text": "법원이 증액 배상을 더하고 Neovasc 특허에 공동발명자를 추가했어요."
      },
      {
        "date": "2017.9.1",
        "text": "연방항소법원이 원심을 유지했어요."
      },
      {
        "date": "2019.4",
        "text": "Neovasc 특허 3건의 발명자 정정을 구한 별건이 합의로 끝났고, 법원이 합의에 따라 발명자 정정을 명령했어요."
      }
    ],
    "result": "법원은 배심 평결 7,000만 달러에 2,100만 달러의 증액 배상을 더해 영업비밀 배상액을 9,100만 달러로 정했고, 이자를 포함한 총액은 약 1억 1,200만 달러예요. 법원은 Neovasc '964 특허에 Quadri와 Ratz를 공동발명자로 추가했지만, Tiara 프로젝트를 18개월 중단시켜 달라는 청구는 기각했어요.",
    "reason": "배심원은 시제품 Rev. C, D, E(영업비밀 1~3)의 유용은 인정하지 않고 영업비밀 4, 5, 6의 유용을 인정했어요. 법원은 공개된 특허출원이 CardiAQ 맨드릴의 정확한 치수, 제조 세부, 재료를 드러내지 않았다고 봤어요. 지법은 금지명령 청구가 금전 배상과 중복되고 생명을 구할 수 있는 기술에 대한 공공의 이익 등을 고려해 기각했어요.",
    "techImpact": "Neovasc의 Tiara 핵심 특허 '964에 CardiAQ 공동창업자 2명이 공동발명자로 추가됐고, CardiAQ를 인수한 Edwards Lifesciences가 이 특허의 공유자가 됐어요. 금지명령이 기각돼 Neovasc는 Tiara 개발을 이어갔고, 2022년 Tiara 개발을 중단했어요.",
    "bizImpact": "평결 다음 날인 2016.5.20 Neovasc 주가는 Business in Vancouver 보도 기준 장중 74% 떨어졌어요. Shockwave Medical은 2023년 Neovasc를 약 1억 달러(1억 3,500만 캐나다달러)에 인수했어요.",
    "ids": {
      "patents": [
        "US 8,579,964"
      ],
      "cases": [
        "D. Mass. 1:14-cv-12405-ADB",
        "CAFC 2017-1302"
      ]
    },
    "sources": [
      {
        "label": "CAFC 2017-1302 판결(FindLaw)",
        "url": "https://caselaw.findlaw.com/court/us-federal-circuit/1872960.html"
      },
      {
        "label": "Knobbe Martens",
        "url": "https://www.knobbe.com/updates/federal-circuit-upholds-112-million-win-knobbe-martens-client-cardiaq/"
      },
      {
        "label": "Neovasc 20-F FY2019",
        "url": "https://www.sec.gov/Archives/edgar/data/1399708/000104746920001915/a2240528z20-f.htm"
      },
      {
        "label": "Business in Vancouver 2016",
        "url": "https://www.biv.com/news/technology/neovasc-shares-drop-74-response-legal-ruling-8246354"
      }
    ]
  },
  {
    "id": "medytox-hugel",
    "kind": "tech",
    "title": "보툴리눔 톡신 균주·제조공정 영업비밀 ITC 조사",
    "plaintiff": "메디톡스",
    "defendant": "휴젤·크로마파마",
    "domain": "바이오의약(미용 주사제)",
    "tech": "보툴리눔 톡신 균주와 톡신 제제 제조공정",
    "keywords": [
      "보툴리눔",
      "톡신",
      "botulinum",
      "균주",
      "제조공정",
      "레티보",
      "Letybo",
      "ITC",
      "국가핵심기술"
    ],
    "relation": "경쟁사",
    "procedures": [
      "미국 ITC"
    ],
    "period": {
      "start": "2022.3",
      "end": "2024.10"
    },
    "steps": [
      {
        "date": "2022.3",
        "text": "메디톡스가 ITC에 337조 조사를 신청했어요."
      },
      {
        "date": "2022.5",
        "text": "ITC가 조사 개시 공고를 냈어요."
      },
      {
        "date": "2023.9",
        "text": "휴젤 발표에 따르면 메디톡스가 2023.9~10 균주 영업비밀 침해 주장을 철회했어요."
      },
      {
        "date": "2024.1",
        "text": "휴젤 발표에 따르면 메디톡스가 제조공정 영업비밀 침해 주장을 철회했어요."
      },
      {
        "date": "2024.6.10",
        "text": "ITC 행정판사가 최종 예비판정에서 337조 위반이 없다고 판정했어요."
      },
      {
        "date": "2024.10.10",
        "text": "ITC 위원회가 최종 예비판정을 일부 검토해 수정한 뒤 확정하고 조사를 종료했어요."
      }
    ],
    "result": "ITC는 337조 위반이 없다고 결론 내고 조사를 종료했어요. 레티보에 대한 수입배제명령과 중지명령은 나오지 않았어요.",
    "reason": "메디톡스가 균주 영업비밀 주장과 제조공정 영업비밀 주장을 철회해, 두 주장은 행정판사의 판단 대상에서 빠졌어요. 휴젤 설명에 따르면 행정판사는 남은 균주 절취·전환 주장이 증거로 뒷받침되지 않는다고 봤어요.",
    "techImpact": "메디톡스가 철회한 균주·제조공정 영업비밀 주장에 대해서는 ITC의 영업비밀 해당 여부 판단이 나오지 않았어요. 레티보의 균주와 제조공정은 ITC 판정에 따른 미국 수입 제한을 받지 않았어요.",
    "bizImpact": "휴젤은 조사 진행 중인 2024.2.29 FDA에서 레티보 50·100유닛 품목허가를 받았어요. 최종판정 다음 날인 2024.10.11 휴젤 주가는 5.58% 올라 255,500원이 됐어요.",
    "ids": {
      "patents": [],
      "cases": [
        "USITC 337-TA-1313",
        "Federal Register 2024-23912(89 FR 83700)"
      ]
    },
    "sources": [
      {
        "label": "Goodwin",
        "url": "https://www.goodwinlaw.com/en/insights/blogs/2022/04/medytox-files-itc-complaint-against-hugel-to-block-import-of-botox-follow-on"
      },
      {
        "label": "휴젤 보도자료 2024.6.11(PR Newswire Asia)",
        "url": "https://en.prnasia.com/releases/global/itc-final-initial-determination-ruled-in-favor-of-hugel-no-violation-of-section-337--450275.shtml"
      },
      {
        "label": "USITC 2024.10.10 공고",
        "url": "https://www.usitc.gov/system/files/secretary/fed_reg_notices/337/337_1313_notice10102024sgl.pdf"
      },
      {
        "label": "Korea Times",
        "url": "https://koreatimes.co.kr/www/nation/2024/10/779_384053.html"
      }
    ]
  },
  {
    "id": "galderma-medinter",
    "kind": "tech",
    "title": "PLLA 필러 특허침해소송",
    "plaintiff": "Galderma",
    "defendant": "Medinter",
    "domain": "의료미용(필러)",
    "tech": "생분해성 PLLA 미립자를 겔에 분산한 피하·피내 주입용 임플란트(Sculptra 플랫폼)",
    "keywords": [
      "PLLA",
      "필러",
      "filler",
      "폴리-L-유산",
      "미립자",
      "임플란트",
      "Sculptra",
      "Derma Veil",
      "궐석판결"
    ],
    "relation": "경쟁사",
    "procedures": [
      "특허 침해소송"
    ],
    "period": {
      "start": "2018.11",
      "end": "2024.2"
    },
    "steps": [
      {
        "date": "2018.11.29",
        "text": "Galderma Laboratories L.P.와 Galderma S.A.가 델라웨어 연방지법에 Medinter 측을 상대로 특허침해소송을 냈어요."
      },
      {
        "date": "2023.12.22",
        "text": "Bloomberg Law가 피고가 배상액 510만 달러를 물게 됐다고 보도했어요. 앞서 피고는 변호인 사임 뒤 법원이 준 새 대리인 선임 기한을 넘겼어요."
      },
      {
        "date": "2024.2.5",
        "text": "델라웨어 연방지법이 Galderma의 판결 전후 이자 신청을 받아들여 수정판결을 냈어요."
      }
    ],
    "result": "델라웨어 연방지법은 궐석판결로 판결전 이자 포함 682.9만 달러를 인정하고, 판결후 이자를 하루 915.5달러(연 복리)로 정했어요. 금지명령 기록은 없어요.",
    "reason": "델라웨어 연방지법은 피고가 대리인을 선임하지 못해 방어하지 않은 상태에서 궐석판결을 내렸어요. 법원의 청구항 해석과 침해·유효성 판단 내용은 공개되지 않았어요.",
    "techImpact": "PatSnap이 표시한 예상 만료일은 US 6,716,251이 2018.6.12, US 7,731,758이 2023.5.1이어서 수정판결 시점에 두 특허는 모두 만료 상태였어요. 판결은 금전 배상과 이자로 이뤄졌고, Derma Veil의 제조·판매 금지는 포함되지 않았어요.",
    "bizImpact": "",
    "ids": {
      "patents": [
        "US 7,731,758 B2",
        "US 6,716,251 B1"
      ],
      "cases": [
        "델라웨어 연방지법 1:18-cv-01892",
        "재심사 90/007,252"
      ]
    },
    "sources": [
      {
        "label": "PatSnap",
        "url": "https://www.patsnap.com/resources/blog/litigation/galderma-v-medinter-sculptra-patent-infringement-judgment-patsnap/"
      },
      {
        "label": "Bloomberg Law 2023.12.22",
        "url": "https://news.bloomberglaw.com/ip-law/dermal-filler-maker-owes-5-1-million-for-patent-infringement"
      },
      {
        "label": "Google Patents US7731758B2",
        "url": "https://patents.google.com/patent/US7731758B2/en"
      }
    ]
  },
  {
    "id": "mastelli-koreabmi",
    "kind": "tech",
    "title": "PDRN 제조방법 특허 무효·침해 분쟁",
    "plaintiff": "마스텔리·파마리서치",
    "defendant": "한국비엠아이",
    "domain": "바이오의약(PDRN 주사제·점안제)",
    "tech": "어류 정액·알에서 분리한 DNA 중합체 단편복합체(PDRN) 제조방법",
    "keywords": [
      "PDRN",
      "DNA 중합체",
      "DNA 단편",
      "어류 정액",
      "연어",
      "제조방법",
      "진보성",
      "주사제",
      "점안제",
      "콘쥬란"
    ],
    "relation": "경쟁사",
    "procedures": [
      "특허 무효심판",
      "특허 침해소송"
    ],
    "period": {
      "start": "2017.1",
      "end": "2022.7"
    },
    "steps": [
      {
        "date": "2017.1",
        "text": "한국비엠아이가 특허 무효심판을 청구했어요."
      },
      {
        "date": "2018.1",
        "text": "특허심판원이 무효심판 청구를 기각했어요."
      },
      {
        "date": "2019.1",
        "text": "특허법원이 특허 무효 판결을 했어요."
      },
      {
        "date": "2019.5",
        "text": "서울중앙지법이 특허권자 측의 침해금지·폐기 청구를 기각했어요."
      },
      {
        "date": "2022.1",
        "text": "대법원이 특허법원 판결을 파기환송했어요."
      },
      {
        "date": "2022.7.21",
        "text": "특허법원이 파기환송심에서 파마리서치 승소 판결을 했어요."
      }
    ],
    "result": "무효 공방은 특허심판원 기각, 특허법원 무효, 대법원 파기환송을 거쳐 2022.7.21 특허법원 파기환송심에서 특허권자 측 승소로 끝났어요. 침해소송은 2019.5 1심에서 기각됐고, 데일리팜 보도에 따르면 무효소송이 진행되는 동안 중단됐어요.",
    "reason": "서울중앙지법(2019.5)은 발명과 정정발명이 진보성이 없어 특허가 무효가 될 것이 명백하므로, 이 특허에 기한 침해금지·폐기 청구는 권리남용이라고 봤어요. 대법원(2022.1)은 진보성을 판단할 때 전체 제조공정 안에서 각 공정이 가진 기술적 의의와 공정 사이의 유기적 결합 관계를 고려해야 하고, 통상의 기술자가 그 결합을 쉽게 생각해 내기 어렵다고 봤어요.",
    "techImpact": "KR 986603은 2022.7.21 파기환송심 판결로 유효 판단을 받았어요. Google Patents는 이 특허의 상태를 존속으로, 예상 만료일을 2028.1.17로 표시해요.",
    "bizImpact": "2019년 당시 PDRN 주사제 시장은 200억~300억원, 점안제 시장은 약 30억원 규모였어요. 파마리서치 콘쥬란 매출은 2019년 약 70억원, 2020년 231억원, 2021년 311억원이에요.",
    "ids": {
      "patents": [
        "KR 10-0986603"
      ],
      "cases": []
    },
    "sources": [
      {
        "label": "데일리팜 2019.5.29",
        "url": "https://www.dailypharm.com/user/news/74030"
      },
      {
        "label": "데일리팜 2022.1.12",
        "url": "https://m.dailypharm.com/user/news/43784"
      },
      {
        "label": "데일리팜 2022.7.26",
        "url": "https://dailypharm.com/user/news/37861"
      },
      {
        "label": "Google Patents KR100986603B1",
        "url": "https://patents.google.com/patent/KR100986603B1/ko"
      }
    ]
  },
  {
    "id": "hironic-ulthera",
    "kind": "tech",
    "title": "HIFU 피부 리프팅 특허 무효심판",
    "plaintiff": "하이로닉",
    "defendant": "Guided Therapy Systems·울쎄라",
    "domain": "의료기기(미용)",
    "tech": "HIFU(고강도 집속 초음파) 피부 리프팅 장치",
    "keywords": [
      "HIFU",
      "고강도 집속 초음파",
      "초음파",
      "ultrasound",
      "리프팅",
      "피부미용",
      "더블로",
      "Doublo",
      "울쎄라",
      "진보성"
    ],
    "relation": "경쟁사",
    "procedures": [
      "특허 무효심판",
      "특허 침해소송"
    ],
    "period": {
      "start": "2013",
      "end": "2014.1"
    },
    "steps": [
      {
        "date": "2013",
        "text": "특허심판원이 하이로닉이 청구한 무효심판에서 GTS 특허를 무효로 하는 심결을 했고, 하이로닉이 이를 공시했어요."
      },
      {
        "date": "2014.1.10",
        "text": "하이로닉과 울쎄라가 각자 제기한 다수의 특허침해소송과 특허무효심판을 모두 취하했다고 보도됐어요."
      }
    ],
    "result": "특허심판원은 GTS의 HIFU 피부미용 특허를 무효로 하는 심결을 했어요. 하이로닉과 울쎄라는 각자의 특허권을 인정하고 서로 제소하지 않는 불제소합의를 맺고 모든 소송을 취하했어요.",
    "reason": "특허심판원은 GTS 특허 청구항의 목적, 구성, 효과가 선행문헌들에 비춰 진보성이 없다고 보고 등록을 무효로 해야 한다고 판단했어요. 진보성 결여로 무효 결론을 내리면서, 일부 청구항이 발명의 상세한 설명으로 뒷받침되는지는 따질 필요가 없다고 봤어요.",
    "techImpact": "GTS의 HIFU 피부미용 특허는 특허심판원에서 무효 심결을 받았어요. 하이로닉은 심결로 더블로가 특허 문제가 없는 독자 개발품임을 확인받았다고 밝혔어요.",
    "bizImpact": "메디칼타임즈는 하이로닉이 침해 경고로 영업에 지장을 받았다고 보도했고, 하이로닉은 심결 뒤 마케팅과 매출 확대를 기대한다고 밝혔어요.",
    "ids": {
      "patents": [],
      "cases": []
    },
    "sources": [
      {
        "label": "메디칼타임즈 2013.8.5",
        "url": "https://www.medicaltimes.com/Main/view.html?ID=1084834"
      },
      {
        "label": "메디칼타임즈 2014.1.10",
        "url": "https://www.medicaltimes.com/Main/view.html?ID=1087727"
      }
    ]
  },
  {
    "id": "btl-lutronic",
    "kind": "tech",
    "title": "비접촉 고주파 바디셰이핑 기기 특허 가처분·무효심판",
    "plaintiff": "BTL",
    "defendant": "루트로닉",
    "domain": "의료기기(미용)",
    "tech": "비접촉식 고주파(초단파) 지방 감소 바디셰이핑 기기",
    "keywords": [
      "고주파",
      "RF",
      "초단파",
      "바디셰이핑",
      "지방 감소",
      "비접촉",
      "엔커브",
      "enCurve",
      "Vanquish",
      "진보성"
    ],
    "relation": "경쟁사",
    "procedures": [
      "침해금지 가처분",
      "특허 무효심판"
    ],
    "period": {
      "start": "2016.4",
      "end": "2017.3"
    },
    "steps": [
      {
        "date": "2016.4.20",
        "text": "BTL메디컬테크놀로지코리아가 서울중앙지법에 엔커브 제조·판매 금지를 구하는 절차를 냈어요."
      },
      {
        "date": "2017.2.14",
        "text": "특허심판원이 루트로닉이 청구한 무효심판에서 BTL 특허를 무효로 하는 심결을 했고, BTL이 불복하지 않아 심결이 확정됐어요."
      },
      {
        "date": "2017.3.24",
        "text": "BTL이 법원 권고에 따라 신청을 취하했어요."
      }
    ],
    "result": "BTL 특허의 무효 심결이 확정됐고, BTL의 신청 취하로 엔커브를 상대로 한 사건은 모두 끝났어요. 법원은 엔커브 판매금지 결정을 내리지 않았어요.",
    "reason": "특허심판원은 공지된 발명이나 문헌을 결합하면 통상의 기술자가 비슷한 발명에 쉽게 이를 수 있다고 보아 BTL 특허의 진보성을 부정했어요. 결합된 선행문헌의 명칭은 공개되지 않았어요.",
    "techImpact": "BTL의 피하 치료용 시스템 특허는 한국에서 무효로 확정됐어요. 법원은 엔커브 판매금지 결정을 내리지 않았어요.",
    "bizImpact": "율촌은 이 결과로 수출을 포함한 엔커브 제조·판매의 불확실성이 줄었다고 밝혔어요.",
    "ids": {
      "patents": [],
      "cases": []
    },
    "sources": [
      {
        "label": "율촌 업무사례(영문)",
        "url": "https://www.yulchon.com/en/resources/deals-and-cases-view/4437/page.do"
      },
      {
        "label": "메디칼타임즈 2016.4.26",
        "url": "https://www.medicaltimes.com/Main/view.html?ID=1104283"
      },
      {
        "label": "메디칼타임즈 2017.2.15",
        "url": "https://www.medicaltimes.com/Main/view.html?ID=1110043"
      }
    ]
  },
  {
    "id": "serendia-itc1356",
    "kind": "tech",
    "title": "RF 마이크로니들 피부치료 기기 ITC 조사",
    "plaintiff": "Serendia",
    "defendant": "제이시스메디칼·루트로닉 등",
    "domain": "의료기기(미용)",
    "tech": "피부에 삽입하는 양극 전극(마이크로니들)에 RF 에너지를 가하는 피부치료 기기",
    "keywords": [
      "RF",
      "마이크로니들",
      "microneedle",
      "고주파",
      "양극 전극",
      "bipolar",
      "피부치료",
      "ITC",
      "EndyMed",
      "제이시스메디칼"
    ],
    "relation": "경쟁사",
    "procedures": [
      "미국 ITC",
      "PTAB"
    ],
    "period": {
      "start": "2023.4",
      "end": "2025"
    },
    "steps": [
      {
        "date": "2023.4.6",
        "text": "ITC가 조사를 개시하고 개시 공고를 냈어요."
      },
      {
        "date": "2023.10.25",
        "text": "행정판사가 청구항 해석 명령에서 '444 청구항 4·6·7이 불명확하다고 판단했어요."
      },
      {
        "date": "2024.1",
        "text": "제이시스메디칼이 PTAB에 Serendia 특허 IPR 2건을 청구했어요."
      },
      {
        "date": "2024.12.19",
        "text": "행정판사가 최종 예비판정에서 EndyMed, 제이시스메디칼, 사이노슈어가 '444를 제외한 4개 특허에 관해 337조를 위반했다고 판정했어요."
      },
      {
        "date": "2025.6.3",
        "text": "ITC 위원회가 EndyMed의 337조 위반을 인정해 제한적 배제명령과 중지명령을 내리고, '444 특허는 행정판사에게 환송했어요."
      },
      {
        "date": "2025.7.29",
        "text": "Serendia와 EndyMed의 라이선스 합의에 따라 ITC 위원회가 제한적 배제명령과 중지명령을 철회했어요."
      }
    ],
    "result": "ITC 위원회는 EndyMed Pure·EndyMed Pro가 Serendia 특허 4건의 남은 청구항을 침해한다고 보고 337조 위반을 인정했지만, 구제명령은 라이선스 합의 뒤 2025.7.29 철회됐어요. 제이시스메디칼·사이노슈어는 무이의 신청으로, 일루다·큐테라·루트로닉 측·Aesthetics Biomedical은 합의로 조사에서 빠졌어요.",
    "reason": "행정판사는 피청구인 측이 자명성, '536 청구항의 신규성 결여, '836 청구항의 실시가능요건·기재요건 위반과 101조 부적격을 입증하지 못했다고 봤어요. ITC 위원회는 '444 청구항 4·6·7이 불명확하다는 행정판사 판단을 뒤집었어요.",
    "techImpact": "Serendia 특허 4건('836, '536, '774, '812)의 남은 청구항은 ITC에서 피청구인 측 무효 주장이 받아들여지지 않은 채 침해 판단을 받았어요. EndyMed는 합의로 주장 특허의 라이선스를 받았어요.",
    "bizImpact": "ITC 위원회는 대통령 검토 기간 보증금을 EndyMed Pure 수입가의 85%, EndyMed Pro 70%로 정했어요. 제이시스메디칼의 조사 제외 예비결정(2024.12.18)은 최종 예비판정(2024.12.19) 하루 전에 나왔어요.",
    "ids": {
      "patents": [
        "US 9,480,836",
        "US 9,320,536",
        "US 9,775,774",
        "US 10,859,812",
        "'379 특허",
        "'444 특허"
      ],
      "cases": [
        "USITC 337-TA-1356",
        "Federal Register 2025-10394",
        "Federal Register 2025-14539",
        "Federal Register 2025-14655"
      ]
    },
    "sources": [
      {
        "label": "Federal Register 2025.6.9(USITC 2025.6.3 최종 결정)",
        "url": "https://www.govinfo.gov/content/pkg/FR-2025-06-09/html/2025-10394.htm"
      },
      {
        "label": "USITC 2025.1.17 공고",
        "url": "https://usitc.gov/sites/default/files/secretary/fed_reg_notices/337/337_1356_notice01172025sgl.pdf"
      },
      {
        "label": "USITC 2025.7.29 공고",
        "url": "https://www.usitc.gov/sites/default/files/secretary/fed_reg_notices/337/337_1356_notice07292025sgl.pdf"
      },
      {
        "label": "Patexia",
        "url": "https://services.patexia.com/lawsuits/Jeisys-Medical-Inc--et-al-v-Serendia-LLC-id-195824"
      }
    ]
  },
  {
    "id": "3shape-medit",
    "kind": "tech",
    "title": "구강스캐너 3D 스캔 처리 특허소송, 독일·미국",
    "plaintiff": "3Shape",
    "defendant": "메디트",
    "domain": "의료기기(치과)",
    "tech": "구강스캐너 3D 스캔 데이터 처리(hole-closing, 움직이는 물체 감지, 포스트·코어 설계)와 무선 스캔·치아 색조 측정",
    "keywords": [
      "구강스캐너",
      "intraoral scanner",
      "3D 스캔",
      "hole-closing",
      "치과",
      "무선 스캔",
      "치아 색조",
      "TRIOS",
      "i500"
    ],
    "relation": "경쟁사",
    "procedures": [
      "특허 침해소송",
      "특허 무효소송"
    ],
    "period": {
      "start": "2019",
      "end": "2024.11"
    },
    "steps": [
      {
        "date": "2019",
        "text": "3Shape가 박람회장에서 소장을 송달하며 독일에서 특허 2건으로 메디트를 제소했어요."
      },
      {
        "date": "2020.1.9",
        "text": "뒤셀도르프 지방법원이 i500이 EP 2 568 870 B1을 침해한다고 판결했고, 메디트는 항소했어요."
      },
      {
        "date": "2021.12.7",
        "text": "뒤셀도르프 지방법원이 EP 2 732 434 B1, EP 3 401 876 B1 침해 주장을 기각했어요."
      },
      {
        "date": "2022.5",
        "text": "독일 연방특허법원이 EP 2 400 919 B1을 무효로 판단했어요."
      },
      {
        "date": "2022.7",
        "text": "3Shape가 미국 텍사스서부지법에 미국 특허 4건 침해를 이유로 손해배상과 금지명령을 청구했어요."
      },
      {
        "date": "2024.11",
        "text": "3Shape와 메디트가 미국 소송을 합의로 끝냈어요."
      }
    ],
    "result": "독일 연방특허법원은 침해 판결이 난 EP 2 568 870과 EP 2 400 919를 무효로 판단했고, 뒤셀도르프 지방법원은 EP 2 400 919 B1, EP 2 732 434 B1, EP 3 401 876 B1의 침해 주장을 기각했어요. 3Shape와 메디트는 미국 소송을 합의로 끝냈고, 합의 조건은 공개되지 않았어요.",
    "reason": "뒤셀도르프 지방법원은 i500이 hole-closing 기술에 관한 EP 2 568 870 B1을 침해한다고 판단했고, 포스트·코어 설계 특허와 움직이는 물체 감지 특허 사건에서는 메디트 제품이 특허를 침해하지 않는다고 판단했어요. 청구항 구성별 대비 내용과 비침해 판단의 기술적 근거는 공개되지 않았고, 연방특허법원의 무효 사유도 보도되지 않았어요.",
    "techImpact": "3Shape 발표에 따르면 2020.1 판결로 i500 당시 버전의 독일 내 마케팅·판매·상업적 사용이 위법이 됐어요. 미국 합의의 라이선스 여부는 공개되지 않았어요.",
    "bizImpact": "MBK파트너스는 2022.12.29 메디트 지분 99.5%를 2조4,500억원에 사는 주식매매계약을 맺었고, 이 시점에 미국 텍사스서부지법 소송은 계속 중이었어요.",
    "ids": {
      "patents": [
        "EP 2 568 870 B1",
        "EP 2 400 919 B1",
        "EP 2 732 434 B1",
        "EP 3 401 876 B1",
        "US 9,629,551",
        "US 10,064,553",
        "US 10,695,151",
        "US 11,076,146"
      ],
      "cases": [
        "뒤셀도르프 지방법원 4c O 11/19",
        "뒤셀도르프 지방법원 4c O 67/19",
        "뒤셀도르프 지방법원 4c O 26/20",
        "뒤셀도르프 지방법원 4c O 27/20"
      ]
    },
    "sources": [
      {
        "label": "JUVE Patent",
        "url": "https://www.juve-patent.com/cases/medit-evens-score-with-3shape-over-3d-scanning-for-dental-implants/"
      },
      {
        "label": "3Shape 보도자료 2020.1.13",
        "url": "https://www.3shape.com/-/media/files/press-release-pdf/2020/3shape-wins-patent-infringement-lawsuit-against-medit.pdf"
      },
      {
        "label": "Dr. Bicuspid",
        "url": "https://www.drbicuspid.com/clinical/imaging-cad-cam/intraoral-scanners/article/15379625/3shape-files-patent-lawsuit-against-medit"
      },
      {
        "label": "Orthodontic Products 2024.11.22",
        "url": "https://orthodonticproductsonline.com/industry-news/company-news/3shape-and-medit-corp-settle-u-s-patent-dispute/"
      }
    ]
  },
  {
    "id": "halozyme-merck",
    "kind": "tech",
    "title": "피하주사용 히알루로니다제 변이체 특허 분쟁, 미국·유럽",
    "plaintiff": "할로자임",
    "defendant": "머크",
    "domain": "바이오의약",
    "tech": "피하주사용 변형 인간 히알루로니다제(PH20 변이체)",
    "keywords": [
      "히알루로니다제",
      "hyaluronidase",
      "PH20",
      "피하주사",
      "MDASE",
      "키트루다",
      "Keytruda",
      "ALT-B4",
      "PGR",
      "실시가능요건"
    ],
    "relation": "경쟁사",
    "procedures": [
      "특허 침해소송",
      "PTAB",
      "가처분",
      "특허 무효소송"
    ],
    "period": {
      "start": "2024.11",
      "end": "진행 중"
    },
    "steps": [
      {
        "date": "2024.11",
        "text": "머크가 할로자임 특허에 PGR 청구를 시작했어요."
      },
      {
        "date": "2025.4.24",
        "text": "할로자임이 뉴저지 연방지법에 키트루다 큐렉스가 MDASE 특허 15건을 침해한다며 손해배상과 금지명령을 청구했어요."
      },
      {
        "date": "2025.12.4",
        "text": "할로자임이 뮌헨 지방법원 제7민사부가 키트루다 SC의 독일 내 유통·청약을 금지하는 가처분을 냈다고 발표했어요."
      },
      {
        "date": "2026.5.12",
        "text": "PTAB이 PGR2025-00003(US 11,952,600) 청구항 1~4, 8~21을 무효로 판단했어요."
      },
      {
        "date": "2026.9.2",
        "text": "PTAB의 다섯 번째 무효 결정이 나왔다고 보도됐어요."
      },
      {
        "date": "2026.10",
        "text": "네덜란드 헤이그 특허법원이 EP 622 침해를 인정하고 머크의 무효 주장을 배척했어요."
      }
    ],
    "result": "미국 PTAB은 2026.9 기준 할로자임 MDASE 특허 5건에 무효 결정을 내렸어요. 뮌헨 지방법원은 가처분으로 키트루다 SC의 독일 내 유통·청약을 금지했고, 헤이그 특허법원은 MSD BV에 8개국에서 키트루다 SC의 제조·청약·마케팅·사용·수입·보관을 금지했어요.",
    "reason": "PTAB은 PGR2025-00003(US 11,952,600)에서 최대 3개 변경을 담은 다중 변형 예 7개가 최대 23개 변형을 허용하는 청구항을 대표하지 못한다며 기재요건 위반을, 활성 변이체를 고를 지침이 적어 과도한 실험이 필요하다며 실시가능요건 위반을 인정하고 자명성 주장은 배척했어요. 헤이그 특허법원의 청구항 해석과 무효 판단의 기술적 근거는 공개되지 않았어요.",
    "techImpact": "미국에서는 최대 23개 변형을 허용하는 US 11,952,600·US 12,152,262 청구항이 기재요건·실시가능요건 위반으로 무효 결정을 받았어요. 유럽에서는 EP 622가 독일 가처분과 헤이그 판결에서 유지됐고, 금지 범위는 피하주사 제형 키트루다 SC에 한정돼요.",
    "bizImpact": "키트루다 큐렉스는 2025.9 FDA 승인 뒤 2025년 미국 매출 약 4,000만 달러(4분기 약 3,500만 달러)를 냈어요. 키트루다 SC는 독일과 헤이그 판결 대상 8개국에서 판매가 막혔어요.",
    "ids": {
      "patents": [
        "US 11,952,600",
        "US 12,152,262",
        "US 12,371,685",
        "US 12,018,298",
        "US 12,123,035",
        "US 12,110,520",
        "EP 2,797,622"
      ],
      "cases": [
        "뉴저지 연방지법 2:25-cv-03179",
        "PGR2025-00003",
        "PGR2025-00006",
        "PGR2025-00087"
      ]
    },
    "sources": [
      {
        "label": "할로자임 소장(Pearce IP 게시)",
        "url": "https://www.pearceip.law/wp-content/uploads/2025/04/Halozyme-v-MSD-Complaint-24-April-2025.pdf"
      },
      {
        "label": "JD Supra",
        "url": "https://www.jdsupra.com/legalnews/keytruda-qlex-tm-updates-final-written-6644057/"
      },
      {
        "label": "할로자임 보도자료 2025.12.4",
        "url": "https://ir.halozyme.com/news/news-details/2025/Halozyme-Wins-Preliminary-Injunction-Against-Mercks-Keytruda-SC-in-Germany"
      },
      {
        "label": "할로자임 보도자료 2026.10.7",
        "url": "https://www.placera.se/pressmeddelanden/halozyme-therapeutics-halozyme-wins-injunction-stopping-manufacture-and-sale-of-merck-s-keytruda-sc-in-multiple-european-markets-20261007"
      }
    ]
  },
  {
    "id": "drdiary-kakaohealthcare",
    "kind": "idea",
    "title": "혈당관리 플랫폼",
    "plaintiff": "닥터다이어리",
    "defendant": "카카오헬스케어",
    "domain": "헬스케어",
    "tech": "혈당관리 플랫폼 사업모델과 사업계획",
    "keywords": [
      "혈당관리",
      "혈당",
      "플랫폼",
      "사업모델",
      "사업계획",
      "CGM",
      "연속혈당측정기",
      "MOU",
      "파스타"
    ],
    "relation": "협업·투자 협의",
    "procedures": [
      "내용증명"
    ],
    "period": {
      "start": "2023.3",
      "end": "2024.1"
    },
    "steps": [
      {
        "date": "2017",
        "text": "닥터다이어리가 혈당관리 플랫폼 운영을 시작했어요."
      },
      {
        "date": "2020",
        "text": "닥터다이어리가 카카오인베스트먼트 투자 제안으로 IR을 진행했어요."
      },
      {
        "date": "2021",
        "text": "닥터다이어리와 카카오브레인이 MOU를 체결했어요."
      },
      {
        "date": "2023.3",
        "text": "카카오헬스케어가 유사한 사업을 발표했고, 닥터다이어리가 내용증명을 보냈어요. 카카오헬스케어는 아이디어 도용을 부인했어요."
      },
      {
        "date": "2023.4.18",
        "text": "닥터다이어리가 롯데·LG·카카오 등에 기술을 뺏겼다고 주장하는 스타트업 공동 기자회견에 참여했어요."
      },
      {
        "date": "2024.1",
        "text": "카카오헬스케어 혈당관리 서비스 '파스타'가 2024.2.1 국내 정식 출시 예정으로 보도됐어요."
      }
    ],
    "result": "공개된 법원·행정기관 판단은 없어요. 카카오헬스케어는 자사 프로젝트의 핵심이 CGM(연속혈당측정기) 데이터를 제조사에서 직접 받아 맞춤 정보를 주는 것이어서 사업모델이 다르다고 반박했어요.",
    "reason": "판단 이유는 공개된 자료가 없어요.",
    "techImpact": "",
    "bizImpact": "",
    "ids": {
      "patents": [],
      "cases": []
    },
    "sources": [
      {
        "label": "딜사이트 2023.10.24",
        "url": "https://dealsite.co.kr/articles/111599"
      },
      {
        "label": "비즈한국 2023.4.18",
        "url": "https://bizhankook.com/articles/25502.html"
      },
      {
        "label": "데일리안",
        "url": "https://www.dailian.co.kr/news/view/1225548/"
      },
      {
        "label": "메디게이트뉴스 2024.1.12",
        "url": "https://medigatenews.com/news/1681390485"
      }
    ]
  },
  {
    "id": "algocare-lottehealthcare",
    "kind": "idea",
    "title": "맞춤형 영양제 디스펜서",
    "plaintiff": "알고케어",
    "defendant": "롯데헬스케어",
    "domain": "헬스케어",
    "tech": "개인 맞춤형 영양제 디스펜서(카트리지, 알약 토출 로터 구조)와 알고케어 등록 특허 '영양제를 제공하기 위한 디스펜서 장치'(2020.10 등록)",
    "keywords": [
      "영양제",
      "디스펜서",
      "dispenser",
      "카트리지",
      "알약 토출",
      "로터",
      "맞춤형",
      "권리범위확인심판",
      "CES"
    ],
    "relation": "협업·투자 협의",
    "procedures": [
      "중기부 행정조사",
      "공정위",
      "권리범위확인심판",
      "중기부 기술분쟁조정"
    ],
    "period": {
      "start": "2023.1",
      "end": "2023.6"
    },
    "steps": [
      {
        "date": "2021.9",
        "text": "알고케어와 롯데헬스케어가 투자·협력을 논의했으나 결렬됐어요."
      },
      {
        "date": "2023.1",
        "text": "롯데헬스케어가 CES 2023에서 유사한 디스펜서를 공개했어요. 같은 달 알고케어 특허를 대상으로 소극적 권리범위확인심판을 청구했어요."
      },
      {
        "date": "2023.1.18",
        "text": "알고케어가 아이디어 도용을 공개 주장하고 공정거래법·부정경쟁방지법 위반 고소 의사를 밝혔어요."
      },
      {
        "date": "2023.1.25",
        "text": "알고케어가 공정위에 신고했어요."
      },
      {
        "date": "2023.2.6",
        "text": "공정위가 롯데지주·롯데헬스케어·캐논코리아를 현장조사했어요."
      },
      {
        "date": "2023.6.7",
        "text": "국회 '스타트업 기술탈취 피해근절 민당정 협의회'에서 양측 합의가 발표됐어요."
      }
    ],
    "result": "알고케어와 롯데헬스케어는 법적 공방 중단, 생태계 활성화 기금 공동 기탁, 일부 협업에 합의했어요. 롯데헬스케어는 디스펜서 사업에서 철수했고 기기는 출시되지 않았으며, 중기부 기술분쟁조정은 알고케어의 취하로 취소됐어요.",
    "reason": "판단 이유는 공개된 자료가 없어요. 롯데헬스케어는 협의가 의견 차이로 중단된 뒤 자체 디스펜서를 개발했고, 카트리지는 일반 기술이며 알약 토출 로터는 자체 개발해 특허 출원 중이라고 반박했어요.",
    "techImpact": "",
    "bizImpact": "롯데헬스케어의 2023년 연결 매출은 8억 원, 영업손실은 229억 원이에요. 롯데헬스케어 앱 '캐즐'은 2024.12.26 종료됐어요.",
    "ids": {
      "patents": [],
      "cases": []
    },
    "sources": [
      {
        "label": "머니투데이 2023.1.18",
        "url": "https://www.mt.co.kr/future/2023/01/18/2023011815442998338"
      },
      {
        "label": "메디게이트뉴스 2023.1.20",
        "url": "https://www.medigatenews.com/news/1935537698"
      },
      {
        "label": "뉴시스 2023.6.7",
        "url": "https://mobile.newsis.com/view/NISX20230607_0002330349"
      },
      {
        "label": "비즈한국 2023.6.14",
        "url": "https://bizhankook.com/articles/25790.html"
      }
    ]
  },
{
  "id": "lgenergy-sk-ev-battery",
  "kind": "tech",
  "title": "전기차 배터리 영업비밀 분쟁 (ITC 337-TA-1159)",
  "plaintiff": "LG화학(현 LG에너지솔루션)",
  "defendant": "SK이노베이션",
  "domain": "이차전지",
  "tech": "전기차용 리튬이온 배터리 셀·모듈·팩의 제조공정(슬러리, 전극 코팅, 파우치 실링, 화성)과 전극·전해액 소재 레시피",
  "keywords": [
    "리튬이온",
    "배터리",
    "슬러리",
    "전극 코팅",
    "파우치 실링",
    "화성",
    "전해액",
    "영업비밀",
    "lithium ion",
    "battery",
    "electrode coating"
  ],
  "relation": "전 직원 이직",
  "procedures": [
    "ITC 337조 조사 (337-TA-1159)",
    "조기패소(default) 판정",
    "제한적 배제명령·중지명령"
  ],
  "period": {
    "start": "2019.4",
    "end": "2021.4"
  },
  "steps": [
    {
      "date": "2019.4.29",
      "text": "LG화학이 ITC에 SK이노베이션을 관세법 337조 위반으로 제소했다."
    },
    {
      "date": "2020.2.14",
      "text": "행정판사가 증거인멸을 이유로 SK이노베이션에 조기패소 예비판정을 내렸다."
    },
    {
      "date": "2021.2.10",
      "text": "ITC 위원회가 337조 위반을 인정하고 제한적 배제명령과 중지명령을 내렸다."
    },
    {
      "date": "2021.4.11",
      "text": "양사가 미국 대통령 검토 시한 직전에 합의했다."
    }
  ],
  "result": "SK이노베이션 배터리의 미국 수입을 10년간 금지하는 배제명령과 중지명령. 합의금 현재가치 2조원(현금 1조원, 로열티 1조원), 국내외 쟁송 취하.",
  "reason": "위원회는 SK이노베이션이 소송을 예견한 뒤에도 문서 파기를 계속했다고 보고 악의를 인정해 조기패소를 확정했다. 영업비밀 목록이 22개 범주로 한정되었고, 독자 개발 기간은 10년으로 판단했다.",
  "techImpact": "배제명령 대상은 22개 영업비밀을 쓴 SK이노베이션의 배터리·셀·모듈·팩·부품이다. 기술 재설계를 입증하면 명령 대상에서 벗어날 수 있다.",
  "bizImpact": "포드·폭스바겐에 4년·2년 예외 기간이 주어졌다. SK이노베이션은 조지아 공장 투자를 회수하기 어렵다고 밝혔다.",
  "ids": {
    "patents": [],
    "cases": [
      "USITC 337-TA-1159"
    ]
  },
  "sources": [
    {
      "label": "USITC 337-TA-1159 위원회 의견서 공개본 2021.3.4",
      "url": "https://ipwatchdog.com/wp-content/uploads/2023/09/1159-Commn-Op.pdf"
    },
    {
      "label": "Mondaq 최종판정 요약",
      "url": "https://www.mondaq.com/unitedstates/export-controls-trade-investment-sanctions/1036394/commission-issues-final-determination-in-certain-lithium-ion-batteries-337-ta-1159"
    },
    {
      "label": "InsideEVs",
      "url": "https://insideevs.com/news/487231/sk-innovation-batteries-banned-10-years-us/"
    },
    {
      "label": "데일리안",
      "url": "https://www.dailian.co.kr/news/view/981043/"
    }
  ]
},
{
  "id": "waymo-uber-lidar",
  "kind": "tech",
  "title": "자율주행 라이다 영업비밀 분쟁 (Waymo vs Uber·Otto)",
  "plaintiff": "Waymo (Alphabet)",
  "defendant": "Uber Technologies, Otto",
  "domain": "자율주행",
  "tech": "자율주행차용 라이다(LiDAR) 하드웨어 설계(회로기판 설계 포함)와 자율주행 소프트웨어",
  "keywords": [
    "라이다",
    "lidar",
    "자율주행",
    "회로기판",
    "영업비밀",
    "self-driving",
    "trade secret",
    "autonomous"
  ],
  "relation": "전 직원 이직",
  "procedures": [
    "민사 영업비밀 소송",
    "예비적 금지명령",
    "형사 기소 (United States v. Levandowski)"
  ],
  "period": {
    "start": "2017.2",
    "end": "2021.1"
  },
  "steps": [
    {
      "date": "2016.8",
      "text": "Uber가 Levandowski가 세운 Otto를 6억8000만 달러에 인수했다."
    },
    {
      "date": "2017.2",
      "text": "Waymo가 Uber를 제소했다."
    },
    {
      "date": "2017.5",
      "text": "Alsup 판사가 Levandowski의 라이다 업무 참여를 금지하고 파일 반환을 명했다."
    },
    {
      "date": "2018.2.9",
      "text": "Waymo와 Uber가 배심 재판 중 합의했다."
    },
    {
      "date": "2020.8.4",
      "text": "Levandowski가 1개 혐의에 유죄를 인정하고 징역 18개월을 선고받았다."
    },
    {
      "date": "2021.1.20",
      "text": "Levandowski가 사면됐다."
    }
  ],
  "result": "Uber가 지분 0.34%(약 2억4500만 달러)를 Waymo에 넘기고 Waymo 기술 사용 금지를 약속했다. Levandowski는 징역 18개월을 선고받았으나 사면됐다.",
  "reason": "민사 사건은 합의로 끝나 본안 판단이 없다. 예비적 금지명령에서 Alsup 판사는 Uber가 Waymo 기밀 파일 1만4000건 이상을 보유한 사실을 알았거나 알았어야 했다고 봤다.",
  "techImpact": "Uber 소프트웨어 일부는 독립 전문가 검토 대상이 되었고, Uber는 Waymo 라이선스를 받거나 기능을 재설계해야 할 수 있다고 공시했다.",
  "bizImpact": "Uber는 Otto 관련 분쟁을 지분 제공으로 정리했다. Levandowski는 Google에 1억7900만 달러 지급 판정 뒤 파산을 신청했다.",
  "ids": {
    "patents": [],
    "cases": [
      "Waymo LLC v. Uber Technologies (N.D. Cal., Alsup)",
      "United States v. Levandowski, No. 5:19-cr-00377"
    ]
  },
  "sources": [
    {
      "label": "Verdict 2017.5.3",
      "url": "https://www.verdict.co.uk/uber-faces-waymo-in-court-battle-over-driverless-car-technology/"
    },
    {
      "label": "Axios 2018.2.9",
      "url": "https://www.axios.com/2018/02/09/stunner-google-and-uber-settle-1518191623"
    },
    {
      "label": "미 법무부 보도자료 2020.8.4",
      "url": "https://www.justice.gov/usao-ndca/pr/former-uber-executive-sentenced-18-months-jail-trade-secret-theft-google"
    },
    {
      "label": "CNBC 2021.1.20",
      "url": "https://www.cnbc.com/2021/01/20/anthony-levandowski-pardoned-after-stealing-trade-secrets-from-google.html"
    },
    {
      "label": "9to5Google 2019.11.7",
      "url": "https://9to5google.com/2019/11/07/waymo-tech-uber/"
    }
  ]
},
{
  "id": "nexon-dnd-trade-secret",
  "kind": "tech",
  "title": "다크앤다커 영업비밀·저작권 분쟁 (넥슨 vs 아이언메이스)",
  "plaintiff": "넥슨",
  "defendant": "아이언메이스(최주현 대표)",
  "domain": "게임",
  "tech": "넥슨 미공개 게임 프로젝트 'P3'의 프로그램·소스코드·빌드 파일·그래픽 리소스와 게임 구성 정보",
  "keywords": [
    "게임",
    "소스코드",
    "그래픽 리소스",
    "빌드",
    "영업비밀",
    "저작권",
    "익스트랙션",
    "game",
    "source code",
    "trade secret",
    "copyright"
  ],
  "relation": "전 직원 이직",
  "procedures": [
    "영업비밀 침해 민사소송",
    "저작권 침해 청구",
    "금지 가처분",
    "형사 고소"
  ],
  "period": {
    "start": "2021.7",
    "end": "2026.4"
  },
  "steps": [
    {
      "date": "2021.7",
      "text": "P3 개발팀 디렉터였던 최주현 대표가 넥슨을 퇴사했다."
    },
    {
      "date": "2021.8",
      "text": "넥슨이 경찰에 고소하고 영업비밀·저작권 침해금지 가처분을 신청했다."
    },
    {
      "date": "2023.8",
      "text": "아이언메이스가 소송 중 다크앤다커를 얼리액세스로 출시했다."
    },
    {
      "date": "2025.2.13",
      "text": "1심이 영업비밀 침해를 인정해 85억원 배상을 명했고, 저작권 침해와 서비스 금지는 기각했다."
    },
    {
      "date": "2025.12.4",
      "text": "2심이 영업비밀 침해를 인정하고 배상액을 57억원대로 줄였다."
    },
    {
      "date": "2026.4.30",
      "text": "대법원이 상고를 모두 기각해 배상액 57억6464만원이 확정됐다."
    }
  ],
  "result": "아이언메이스가 넥슨에 57억6464만원을 배상하도록 확정. 저작권 침해는 인정되지 않았고, 서비스 금지는 명령되지 않았다.",
  "reason": "P3 소스코드와 그래픽 리소스를 하나의 영업비밀로 특정할 수 있다고 봤다. 보호기간은 퇴사 시점부터 얼리액세스 시점까지로 제한됐고, 저작권은 P3에 구현·공표되지 않은 요소라 보호받기 어렵다고 판단했다.",
  "techImpact": "저작권 기반 사용 제한 판단은 없었다. 영업비밀 보호기간 종료 이후 서비스 금지는 인정되지 않았다.",
  "bizImpact": "다크앤다커는 소송 중 얼리액세스로 출시됐다. 크래프톤의 모바일 글로벌 라이선스는 2025.2 합의 해지됐다.",
  "ids": {
    "patents": [],
    "cases": [
      "대법원 2026다200492 (1심 서울중앙지법 2025.2.13, 2심 서울고법 2025.12.4)"
    ]
  },
  "sources": [
    {
      "label": "법률신문",
      "url": "https://www.lawtimes.co.kr/news/articleView.html?idxno=220172"
    },
    {
      "label": "헤럴드경제 2025.12.4",
      "url": "https://www.heraldk.com/article/2025120400511251185"
    },
    {
      "label": "파이낸셜뉴스 2025.2.17",
      "url": "https://www.fnnews.com/news/202502171718369753"
    },
    {
      "label": "서울경제",
      "url": "https://www.sedaily.com/article/20039002"
    }
  ]
},
{
  "id": "shinsaeng-carbide",
  "kind": "tech",
  "title": "초경합금 제조기술 영업비밀 분쟁 (신생공업 vs K사)",
  "plaintiff": "신생공업",
  "defendant": "K사(전 신생공업 전문경영인 설립), 일본 S사 공동",
  "domain": "금속소재",
  "tech": "내마모계열 초경합금 제조기술(원료관리표준, 소결자료, 금형설계자료, 원료공급업체 정보)",
  "keywords": [
    "초경합금",
    "소결",
    "금형 설계",
    "원료 관리",
    "영업비밀",
    "cemented carbide",
    "sintering",
    "trade secret"
  ],
  "relation": "전 직원 이직",
  "procedures": [
    "영업비밀 침해 민사소송 (1심·항소심)",
    "형사 고소 (산업기술유출방지법, 부정경쟁방지법, 업무상배임)"
  ],
  "period": {
    "start": "2011.5",
    "end": "2017.5"
  },
  "steps": [
    {
      "date": "2011.5",
      "text": "K씨가 신생공업 전문경영인으로 퇴사하며 원료·소결·금형 자료를 USB 등으로 가져갔다고 주장됐다."
    },
    {
      "date": "2011.7",
      "text": "K씨가 일본 동종업체 S사의 지원을 받아 K사를 설립했다."
    },
    {
      "date": "2012",
      "text": "신생공업이 형사 고소했으나 불기소처분이 나왔다. 항고 뒤 2015.6 업무상배임 기소가 이뤄졌다."
    },
    {
      "date": "1심",
      "text": "대구지법 서부지원이 영업비밀 침해를 인정해 약 71억9900만원 배상을 명했다."
    },
    {
      "date": "2017.5.11",
      "text": "대구고법이 항소심에서 배상액을 77억8000만원으로 늘렸다."
    }
  ],
  "result": "항소심 배상액 77억8000만원(지연손해금 포함). 일본 S사도 공동 배상 책임. 금지청구 일부는 침해 후 4년 이상 경과를 이유로 기각.",
  "reason": "반출 자료가 초경합금 생산의 핵심 정보라 영업비밀로 인정했다. 접근 직원 제한, 패스워드, 비밀준수의무 같은 관리 조치로 중소기업의 비밀유지성을 인정했다.",
  "techImpact": "K사는 설립 4개월 만에 완제품을 출시했다고 주장됐다. 금지청구는 시간 경과로 일부 제한됐다.",
  "bizImpact": "K사 매출은 2012년 약 57억원에서 2015년 약 114억원으로 늘었다. 신생공업 매출은 2011년 약 434억원에서 2015년 약 286억원으로 줄었다.",
  "ids": {
    "patents": [],
    "cases": []
  },
  "sources": [
    {
      "label": "한국일보 2016.7.26",
      "url": "https://www.hankookilbo.com/news/article/201607261855765387"
    },
    {
      "label": "경북매일 2017.5.12",
      "url": "https://kbmaeil.com/article/201705120192058"
    },
    {
      "label": "법무법인 세종 뉴스레터 2017.5.19",
      "url": "https://shinkim.com/kor/media/newsletter/941"
    }
  ]
},
{
  "id": "samsung-boe-oled",
  "kind": "tech",
  "title": "OLED 특허·영업비밀 분쟁 (ITC 337-TA-1351·1378)",
  "plaintiff": "삼성디스플레이",
  "defendant": "BOE Technology Group 및 계열사",
  "domain": "디스플레이",
  "tech": "스마트폰용 AMOLED 패널 화소 구조(다이아몬드 픽셀 등)와 OLED 디스플레이 모듈 제조 영업비밀",
  "keywords": [
    "oled",
    "amoled",
    "디스플레이",
    "화소",
    "다이아몬드 픽셀",
    "패널",
    "영업비밀",
    "display",
    "pixel",
    "trade secret"
  ],
  "relation": "전 직원 이직",
  "procedures": [
    "ITC 337조 특허 침해 조사 (337-TA-1351)",
    "ITC 337조 영업비밀 조사 (337-TA-1378)",
    "텍사스 연방법원 특허 소송"
  ],
  "period": {
    "start": "2022.12",
    "end": "2026.1"
  },
  "steps": [
    {
      "date": "2022.12",
      "text": "삼성디스플레이가 BOE와 미국 유통사를 상대로 ITC와 텍사스 법원에 AMOLED 특허 침해 소송을 냈다."
    },
    {
      "date": "2023.10.31",
      "text": "영업비밀 침해를 이유로 ITC 337조 조사를 신청했다."
    },
    {
      "date": "2024.11",
      "text": "337-TA-1351 행정판사가 특허 유효성을 인정하고 BOE 3건, 미국 도매업체 4건 침해를 판정했다."
    },
    {
      "date": "2025.7.11",
      "text": "337-TA-1378 행정판사가 337조 위반과 제한적 배제명령(15년 0.5개월) 등을 권고했다."
    },
    {
      "date": "2025.11",
      "text": "양사가 합의하고 텍사스 소송 3건을 취하했다."
    },
    {
      "date": "2026.1.5",
      "text": "ITC 위원회가 합의를 이유로 337-TA-1378 조사를 종료했다."
    }
  ],
  "result": "337-TA-1351: BOE 침해 판단 유지, 수입·판매 금지는 부과되지 않음. 337-TA-1378: 합의로 종료, 구제명령 없음. 합의 조건은 비공개이며 로열티 보도가 있었으나 확인되지 않음.",
  "reason": "행정판사는 영업비밀 범주 TS I·II·IV·VII 침해를 인정하고 TS III는 침해가 아니라고 봤다. DTSA 소멸시효는 337조 조사에 적용되지 않는다고 판단했다.",
  "techImpact": "권고 배제명령 대상은 침해 영업비밀을 쓴 OLED 모듈과 패널이었다. 다툼 대상 특허 5건 중 4건은 PTAB에서 유효성을 유지했다.",
  "bizImpact": "BOE는 장기 수입배제 없이 주요 스마트폰 업체에 패널 공급을 이어 갈 수 있게 됐다. 첫 소송부터 합의까지 약 3년이 걸렸다.",
  "ids": {
    "patents": [],
    "cases": [
      "USITC 337-TA-1351",
      "USITC 337-TA-1378"
    ]
  },
  "sources": [
    {
      "label": "KED Global 2025.11.20",
      "url": "https://www.kedglobal.com/electronics/newsView/ked202511200007"
    },
    {
      "label": "Korea Times 2025.3.20",
      "url": "https://www.koreatimes.co.kr/business/tech-science/20250320/samsung-display-wins-oled-patent-suit-over-boe"
    },
    {
      "label": "USITC 2025.9.11 공고 (Federal Register 2025-18459)",
      "url": "https://public-inspection.federalregister.gov/2025-18459.pdf"
    },
    {
      "label": "USITC 2026.1.5 공고 (Federal Register 2026-00099)",
      "url": "https://public-inspection.federalregister.gov/2026-00099.pdf"
    }
  ]
},
{
  "id": "huawei-samsung-4g-sep",
  "kind": "tech",
  "title": "4G LTE 표준필수특허 침해소송 (화웨이 vs 삼성전자, 선전)",
  "plaintiff": "화웨이",
  "defendant": "삼성전자 및 중국 법인",
  "domain": "통신",
  "tech": "4G LTE 표준필수특허(SEP)와 FRAND 라이선스 조건",
  "keywords": [
    "lte",
    "4g",
    "표준필수특허",
    "sep",
    "frand",
    "라이선스",
    "통신",
    "standard essential",
    "licensing",
    "royalty"
  ],
  "relation": "경쟁사 간 분쟁",
  "procedures": [
    "중국 선전 중급인민법원 특허침해 소송",
    "미국 캘리포니아 북부 연방법원 소송금지명령",
    "합의"
  ],
  "period": {
    "start": "2016.5",
    "end": "2019.2"
  },
  "steps": [
    {
      "date": "2016.5.24",
      "text": "화웨이가 미국 연방법원에 삼성전자를 제소했고, 다음 날 중국에서도 제소했다."
    },
    {
      "date": "2018.1",
      "text": "선전 중급인민법원이 삼성 4G 스마트폰의 화웨이 표준필수특허 2건 침해를 인정하고 중국 내 제조·판매 금지를 명령했다."
    },
    {
      "date": "2018.4.13",
      "text": "미국 연방법원이 화웨이의 선전 판결 집행을 막는 소송금지명령을 내렸다."
    },
    {
      "date": "2019.2.25",
      "text": "양사가 합의했다. 조건은 공개되지 않았다."
    }
  ],
  "result": "선전 법원은 침해와 금지명령을 인정했으나, 미국 소송금지명령으로 집행되지 않은 상태에서 합의가 이뤄졌다.",
  "reason": "법원은 3GPP 기술규격을 기준으로 표준필수성을 판단했다. 삼성전자가 표준필수특허만의 라이선스 논의를 거부하고 화웨이 제안에 답하지 않은 점을 FRAND 과실로 봤다.",
  "techImpact": "금지명령은 두 특허를 쓰는 단말과 네트워크 기기 전반에 미칠 수 있었다.",
  "bizImpact": "삼성전자 중국 법인의 4G 스마트폰 판매 금지 위험이 있었고, 합의로 정리됐다.",
  "ids": {
    "patents": [
      "ZL201110269715.3",
      "ZL201010137731.2"
    ],
    "cases": [
      "(2016)粤03民初816号·840号 (Bird & Bird 기재)",
      "16-cv-02787-WHO (N.D. Cal.)"
    ]
  },
  "sources": [
    {
      "label": "Bird & Bird 2018 (Conventus Law 게재)",
      "url": "https://conventuslaw.com/report/china-shenzhen-court-grants-injunctions-in-sep/"
    },
    {
      "label": "World IP Review",
      "url": "https://www.worldipreview.com/news/chinese-court-rules-against-samsung-again-15183"
    },
    {
      "label": "techpartner.news",
      "url": "https://www.techpartner.news/news/huawei-samsung-agree-to-settle-patent-dispute-519924"
    },
    {
      "label": "Wikipedia: Samsung v. Huawei",
      "url": "https://en.wikipedia.org/wiki/Samsung_v._Huawei"
    }
  ]
},
{
  "id": "lgenergy-sunwoda-separator",
  "kind": "tech",
  "title": "배터리 분리막·전극조립체 특허 침해소송 (LG에너지솔루션 공동보유 vs 신왕다, 뮌헨)",
  "plaintiff": "Tulip Innovation (LG에너지솔루션·파나소닉 특허 라이선스 대리인)",
  "defendant": "신왕다(Sunwoda)",
  "domain": "이차전지",
  "tech": "리튬이온 배터리 분리막(SRS 코팅)과 전극·분리막 결합 구조",
  "keywords": [
    "분리막",
    "separator",
    "srs",
    "코팅",
    "전극 조립체",
    "리튬이온",
    "배터리",
    "battery",
    "electrode assembly"
  ],
  "relation": "경쟁사 간 분쟁",
  "procedures": [
    "독일 뮌헨 지방법원 특허 침해소송",
    "금지명령·판매금지 판결"
  ],
  "period": {
    "start": "2025.5",
    "end": "2025.7"
  },
  "steps": [
    {
      "date": "2025.5.22",
      "text": "뮌헨 지방법원이 두 특허 사건에서 금지명령을 냈다."
    },
    {
      "date": "2025.7.3",
      "text": "뮌헨 지방법원이 세 번째 특허 사건 구두심리를 열었다."
    },
    {
      "date": "2025.7.17",
      "text": "뮌헨 지방법원이 세 번째 특허 침해를 인정하는 판결을 했다."
    }
  ],
  "result": "대상 배터리의 금지명령, 잔여 재고 회수·폐기, 손해배상 책임 인정과 회계정보 제공 명령. 즉시 집행 가능, 신왕다는 항소 가능.",
  "reason": "청구항별 침해 판단 근거는 공개되지 않았다. 신왕다는 세 특허에 대해 무효소송을 냈고 계속 진행 중이다.",
  "techImpact": "금지 대상은 다치아 스프링에 쓰인 특정 신왕다 배터리 모델로 보도되었다.",
  "bizImpact": "신왕다는 대상 배터리를 독일에서 팔 수 없게 되었다. 손해배상액은 공개되지 않았다.",
  "ids": {
    "patents": [
      "EP 1 829 139 B1",
      "EP 2 528 141 B1",
      "EP 2 378 595 B1"
    ],
    "cases": []
  },
  "sources": [
    {
      "label": "헤럴드경제 2025.7.24",
      "url": "https://biz.heraldcorp.com/article/10538562"
    },
    {
      "label": "Tulip 보도자료 2025.5.27 (IPWatchdog)",
      "url": "https://ipwatchdog.com/press/tulip-innovation-obtains-landmark-injunctions-battery-patent-dispute-sunwoda-group/"
    },
    {
      "label": "Tulip 보도자료 2025.7.24 (Kyodo PR Wire)",
      "url": "https://kyodonewsprwire.jp/release/202507242623"
    }
  ]
}
];
