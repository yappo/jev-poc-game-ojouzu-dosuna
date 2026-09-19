// Prewritten reaction parts. The game never asks Jev to generate prose: it
// chooses one of the 25 x 2 combinations for the current character.
const banks = {
  elementary:{
    win:{ prefixes:['わあ、','やったあ、','ほんとに？','えへへ、','お話を聞いてみたけど、'], tails:['なんだかうれしい言い方だね！','ほめてくれたみたいでうれしいな！','ことばの使い方がおもしろいね！','むずかしい言葉でも、いい意味だと思ったよ。','なんだか仲よくなれた気がする！'], images:['sunny-smile','schoolyard-wave','innocent-pride'] },
    lose:{ prefixes:['えっ、','うーん、','ねえ、','ちょっと待って、','よく聞いてみたら、'], tails:['今の言い方はほめ言葉に聞こえなかったよ。','ほんとうは怒ってたの？','そんな言い方、ぼくにはむずかしいよ。','つぎはもっとやさしく言ってね。','ぼく、嫌なことを言われた気がする。'], images:['confused-frown','puzzled-point','teary-question'] }
  },
  middle:{
    win:{ prefixes:['まあ、','ふーん、','一応な、','そこまで言うなら、','聞いた感じでは、'], tails:['今回は普通のほめ言葉ってことでええわ。','まだ嫌味やとは思わへんかった。','その程度なら聞き流せるな。','次もその調子で言ってみ。','今回はうまいこと言われた気がするわ。'], images:['street-shrug','street-smirk','street-challenge'] },
    lose:{ prefixes:['それ、','なんや、','ちょっと、','回りくどく言わんでも、','よく聞いたら、'], tails:['ほめてるふりして刺してきたやろ。','嫌味は嫌味やで。','その言い方、普通には聞こえへん。','言葉の裏に意味がありそうやったな。','こっちをからかってるの、分かるからな。'], images:['street-point','street-crossed-arms','street-laugh'] }
  },
  high:{
    win:{ prefixes:['今のところ、','一応、','含みは感じるけど、','聞いてみても、','その言い方なら、'], tails:['ただのほめ言葉として通ったみたいだね。','嫌味だって証拠はなかったよ。','今回は善意として受け取っておく。','まだ疑うほどではないかな。','あなたの勝ちってことにしておくよ。'], images:['school-confident','school-sideeye','school-challenge'] },
    lose:{ prefixes:['それ、','やっぱり、','丁寧に言ってるけど、','よく考えてみたら、','なんとなく引っかかるな。'], tails:['ほめてるふりして何か言いたいやろ。','別の意味を込めてるよね。','言葉の選び方が引っかかるな。','自然なほめ言葉には聞こえなかった。','隠したつもりの嫌味まで聞こえたよ。'], images:['school-suspicious','school-crossed-arms','school-knowing'] }
  },
  university:{
    win:{ prefixes:['含みは感じたけど、','言葉の選び方を考えても、','会話として読むなら、','まだ善意の読みも成立するから、','その言葉だけでは、'], tails:['嫌味だと断定するほどの根拠はなかった。','今回はほめ言葉として処理できるかな。','曖昧さを残したまま、あなたの勝ちにするよ。','別の意味を考えすぎなくてもよさそうだね。','こちらの読みすぎだったみたいだ。'], images:['campus-thoughtful','campus-notebook','campus-smile'] },
    lose:{ prefixes:['なるほどね。','表面だけならきれいだけど、','言い回しを振り返ってみると、','会話の流れまで考えると、','不思議な褒め方だね。'], tails:['別の意味を込めたと考えるほうが自然だよ。','説明しにくい含みが見えてくるね。','相手を軽く見ている感じが残る。','その言い回しは嫌味として受け取るよ。','言葉の表面だけではごまかせないよ。'], images:['campus-analysis','campus-sideeye','campus-quiet'] }
  },
  adult:{
    win:{ prefixes:['含みのある言葉でしたが、','言葉を確認しても、','この場面の会話としては、','相手の立場まで考えると、','言葉の選び方は巧みですが、'], tails:['善意として通せる範囲でしょう。','敵意までは確認できませんでした。','今回はあなたの勝ちとして処理します。','こちらの読みすぎだったようです。','批判と断定する材料は不足しています。'], images:['office-composed','office-nod','office-smile'] },
    lose:{ prefixes:['丁寧なお言葉ですね。','お言葉を振り返りますと、','その対象を褒めるのですね。','社会人同士の会話なら、','表面の丁寧さとは別に、'], tails:['配慮ではなく批判を包んでいますね。','偶然とは思えないほど意地が悪いですね。','相手の時間や立場を軽く扱っています。','その含みは嫌味として受け取ります。','言葉の裏まで確認する必要があります。'], images:['office-serious','office-notebook','office-knowing'] }
  },
  kyoto:{
    win:{ prefixes:['表のお言葉だけなら、','場面とのずれはありましたけど、','お見事どすなぁ。','その褒め方を聞かせてもろても、','こちらの耳には、'], tails:['よろしい褒め言葉どした。','嫌味と決めつけるほどではおへん。','裏の真意までは分かりしまへんなぁ。','敵意やと断じる材料は足りまへんなぁ。','きれいにすり抜けはりましたえ。'], images:['machiya-smile','machiya-fan','machiya-bow'] },
    lose:{ prefixes:['お上手どすなぁ。','その敬語、その褒める場所、その場面、','お言葉をよう聞きますとなぁ、','表では笑ろておりますけど、','言葉の端々まで聞かせてもろたら、'], tails:['嫌味まできれいに包んではります。','どれも偶然やおへんなぁ。','裏の真意までよう見えておりますえ。','お気持ちは隠せておりまへん。','こちらには別の意味が伝わっております。'], images:['machiya-knowing','machiya-fan-closed','machiya-shadow'] }
  }
};

function expand(stageId, tone) {
  const bank = banks[stageId][tone];
  return bank.prefixes.flatMap((prefix, prefixIndex) => bank.tails.map((tail, tailIndex) => ({
    id:`${stageId}-${tone}-${prefixIndex + 1}-${tailIndex + 1}`,
    tone,
    text:`${prefix}${tail}`,
    imagePattern:bank.images[(prefixIndex + tailIndex) % bank.images.length]
  })));
}

export const COMMENT_BANKS = Object.fromEntries(Object.keys(banks).map(stageId => [stageId, {
  win:expand(stageId,'win'),
  lose:expand(stageId,'lose')
}]));

export function commentsFor(stageId, tone) {
  return COMMENT_BANKS[stageId]?.[tone] ?? [];
}

const neutral = {
  elementary:['どういうことをほめてくれたのかな？','うまくお話が伝わらなかったみたい。','もう少し考えてから、また聞かせてね。'],
  middle:['何が言いたいんか、ちょっと分からんかったわ。','その言い方では勝負にならへんな。','もうひと工夫してきいや。'],
  high:['それがこの場面とどうつながるのかな。','今の言い方だと、勝負の形になっていないね。','言葉を選び直して、また聞かせてよ。'],
  university:['場面と言葉のつながりを、もう少し考えてみようか。','褒め言葉で伝えるには、別の表現が要りそうだね。','まだ言いたいことが伝わり切っていないと思うよ。'],
  adult:['この場で何を伝えたいか、整理してみてください。','褒め言葉として伝えるには、工夫が必要ですね。','もう一度、言葉を選んでみてはいかがでしょう。'],
  kyoto:['そのお言葉、こちらのお話とどうつながりますやろ。','褒めておられるんか、ちょっと分かりしまへんなぁ。','お言葉を整えて、またおいでやす。']
};

export function neutralCommentsFor(stageId) {
  return neutral[stageId].map((text,index)=>({id:`${stageId}-neutral-${index}`,text,imagePattern:'reaction-confused'}));
}
