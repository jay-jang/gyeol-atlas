// Editorial search labels for exactly the source-named spinal segments.
// Do not infer missing segments, rename canonical source concepts, or diagnose.
export function femaleSpinalLabel(conceptId){
  const cervical=/^HRA:C([1-8])_segment_of_cervical_spinal_cord$/.exec(conceptId);
  const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth'];
  const other=/^HRA:([a-z]+)_(thoracic|lumbar|sacral)_spinal_cord_segment$/.exec(conceptId);
  let region,number;
  if(cervical){region='cervical';number=Number(cervical[1]);}
  else if(other){region=other[2];number=ordinals.indexOf(other[1]==='eigth'?'eighth':other[1])+1;}
  const definitions={cervical:['C','경수',0,8],thoracic:['T','흉수',8,12],lumbar:['L','요수',20,5],sacral:['S','천수',25,4]};
  if(!region||!number||number>definitions[region][3])throw new Error(`Unsupported source spinal segment: ${conceptId}`);
  const [prefix,ko,offset]=definitions[region],code=`${prefix}${number}`;
  return {code,label:`제${number}${ko} 분절 (${code} 척수)`,order:offset+number};
}
