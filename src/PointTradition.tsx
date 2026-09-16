import data from '../data/acupoint-theory.json';
import type { Point } from './types';

const theory = data as Record<string, {
  yinYang: string | null; channelElement: string | null;
  fiveShu: { type: string; element: string } | null; explanation: string;
}>;

export default function PointTradition({ point }: { point: Point }) {
  const t = theory[point.id];
  return <section className="point-tradition" aria-label="전통적 효능과 음양오행">
    <h3>전통적으로 언급된 용도</h3>
    {point.traditionStatus === 'landmark-only'
      ? <p>유중(ST17)은 가슴의 위치를 가늠하는 기준점으로 설명됩니다. 치료 효능을 부여하지 않았습니다.</p>
      : <><p className="traditional-indications">{point.traditionalIndications.join(' · ')}</p>
        <p className="muted small">문헌상 용도를 간추린 학습 정보입니다. 각 경혈의 치료 효과가 임상적으로 입증되었다는 뜻은 아닙니다.</p></>}
    <h3>음양오행으로 읽기</h3>
    <dl className="theory-facts">
      <div><dt>경맥 음양</dt><dd>{t.yinYang || '별도 배속 없음'}</dd></div>
      <div><dt>경맥 오행</dt><dd>{t.channelElement || '별도 배속 없음'}</dd></div>
      <div><dt>오수혈 오행</dt><dd>{t.fiveShu ? `${t.fiveShu.type} · ${t.fiveShu.element}` : '해당 없음'}</dd></div>
    </dl>
    <p>{t.explanation}</p>
    <p className="muted small">음양오행과 장부는 전통 의학의 분류 언어입니다. 현대 해부 구조나 물리적 작용 경로와 동일하지 않습니다.</p>
    <a href={point.traditionSourceUrl} target="_blank" rel="noreferrer">이 경혈의 전통 용도 출처 ↗</a>
    <a href="#wiki/yin-yang-five-phases">음양오행·오수혈 안내 ↗</a>
    {point.traditionLicense && <small>TCM Wiki를 한국어로 간추리고 편집 · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></small>}
  </section>;
}
