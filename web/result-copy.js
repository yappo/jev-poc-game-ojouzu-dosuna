const reasons={
  scene:'この場面には、批判する対象となる問題が見当たりません。',
  meaning:'この場面の困りごとに結びつく嫌味が伝わりませんでした。褒める対象や言い回しを工夫してみてください。',
  praise:'表向きの褒め言葉として伝わりませんでした。感心や称賛の形に包んでみてください。',
  direct:'悪口や要求が直接伝わっています。褒め言葉の裏に隠してみてください。',
  coherence:'会話として読み取れませんでした。相手に話しかける言葉で入力してください。'
};
export function resultCopy(result){
  if(result.result==='invalid')return {title:'嫌味が成立しませんでした',detail:(result.reasons||[]).map(r=>reasons[r]).filter(Boolean).join(' ')||'褒め言葉の形と、場面とのつながりを見直してみてください。'};
  if(result.result==='caught')return {title:'見抜かれました',detail:'嫌味としては成立しましたが、相手に裏の意味を読み取られました。'};
  if(result.result==='success')return {title:'うまく包めました',detail:'嫌味として成立し、相手は敵意を十分に見抜けませんでした。あなたの勝ちです。'};
  return {title:'判定を確認できませんでした',detail:'判定結果を読み取れませんでした。'};
}
