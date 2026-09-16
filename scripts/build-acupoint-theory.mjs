import fs from 'node:fs';
const catalogue = JSON.parse(fs.readFileSync('data/acupoint-catalogue.json', 'utf8'));
const channelRows = [
  ['LU', '음', '금', '폐', 'LI'], ['LI', '양', '금', '대장', 'LU'],
  ['ST', '양', '토', '위', 'SP'], ['SP', '음', '토', '비', 'ST'],
  ['HT', '음', '화', '심', 'SI'], ['SI', '양', '화', '소장', 'HT'],
  ['BL', '양', '수', '방광', 'KI'], ['KI', '음', '수', '신', 'BL'],
  ['PC', '음', '화', '심포', 'TE'], ['TE', '양', '화', '삼초', 'PC'],
  ['GB', '양', '목', '담', 'LR'], ['LR', '음', '목', '간', 'GB'],
];
const shuNumbers = {
  LU: [11, 10, 9, 8, 5], LI: [1, 2, 3, 5, 11], ST: [45, 44, 43, 41, 36],
  SP: [1, 2, 3, 5, 9], HT: [9, 8, 7, 4, 3], SI: [1, 2, 3, 5, 8],
  BL: [67, 66, 65, 60, 40], KI: [1, 2, 3, 7, 10], PC: [9, 8, 7, 5, 3],
  TE: [1, 2, 3, 6, 10], GB: [44, 43, 41, 38, 34], LR: [1, 2, 3, 4, 8],
};
const phases = { 음: ['목', '화', '토', '금', '수'], 양: ['금', '수', '목', '화', '토'] };
const shuTypes = ['정(井)', '형(滎)', '수(輸)', '경(經)', '합(合)'];
const categories = {
  yuan: 'LU9 LI4 ST42 SP3 HT7 SI4 BL64 KI3 PC7 TE4 GB40 LR3'.split(' '),
  mu: 'LU1 ST25 CV12 LR13 CV14 CV4 CV3 GB25 CV17 CV5 GB24 LR14'.split(' '),
  luo: 'LU7 LI6 ST40 SP4 HT5 SI7 BL58 KI4 PC6 TE5 GB37 LR5 GV1 CV15 SP21'.split(' '),
};
const theory = Object.fromEntries(catalogue.map(p => {
  const channel = channelRows.find(r => r[0] === p.meridian);
  const shuIndex = (shuNumbers[p.meridian] || []).findIndex(n => `${p.meridian}${n}` === p.id);
  const shu = shuIndex < 0 ? null : {
    type: shuTypes[shuIndex], element: phases[channel[1]][shuIndex],
  };
  return [p.id, {
    yinYang: channel?.[1] || (p.meridian === 'CV' ? '음맥의 바다' : p.meridian === 'GV' ? '양맥의 바다' : null),
    channelElement: channel?.[2] || null,
    traditionalOrgan: channel?.[3] || null,
    pairedMeridian: channel?.[4] || null,
    fiveShu: shu,
    categories: [...Object.entries(categories).filter(([, ids]) => ids.includes(p.id)).map(([k]) => k), ...(shu ? ['five-shu'] : [])],
    explanation: channel
      ? `${p.meridian}의 전통적 경맥 분류는 ${channel[1]}·${channel[2]}이며 ${channel[3]}에 대응합니다. ${shu ? `이 경혈은 오수혈의 ${shu.type}혈로 ${shu.element}에 배속됩니다.` : '이 경혈은 오수혈 60개에 속하지 않아 개별 오수혈 오행을 부여하지 않습니다.'}`
      : p.meridian === 'EX'
        ? '경외기혈은 14경맥 밖의 별도 분류입니다. 이 목록에서는 소속 경맥의 음양·오행이나 오수혈 오행을 지정하지 않습니다.'
        : `${p.meridian === 'CV' ? '임맥은 음맥의 바다' : '독맥은 양맥의 바다'}로 설명하는 기경팔맥의 하나입니다. 십이경맥의 장부 오행이나 오수혈 배속을 그대로 적용하지 않습니다.`,
    sourceIds: ['point-categories', 'five-shu-theory'],
  }];
}));
fs.writeFileSync('data/acupoint-theory.json', JSON.stringify(theory, null, 2) + '\n');
console.log(`Theory: ${Object.keys(theory).length} points; ${Object.values(theory).filter(t => t.fiveShu).length} Five Shu.`);
