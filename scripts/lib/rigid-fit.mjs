import {Matrix3,Vector3} from 'three';
import {fitSimilarity} from './similarity-fit.mjs';

// The optimal proper rotation is shared by isotropic similarity and rigid
// least squares. Recompute translation after removing the fitted scale.
export function fitRigid(from,onto){
  const result=fitSimilarity(from,onto),scale=Math.cbrt(result.determinant());
  result.scale(new Vector3(1/scale,1/scale,1/scale));
  const mean=points=>points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/points.length);
  const translatedMean=mean(from).applyMatrix3(new Matrix3().setFromMatrix4(result));
  result.setPosition(mean(onto).sub(translatedMean));return result;
}
