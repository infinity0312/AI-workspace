import type { LearningLesson } from './learning-quality';
import type { LearningEvidence } from '../runtime/learning-workflow';

export function crystalAngleLesson(question:string|undefined,evidence:LearningEvidence[]):LearningLesson|undefined {
  if (!question || !/CGCNN/i.test(question) || !/ALIGNN/i.test(question) || !/夹角|键角/i.test(question)) return;
  const cgcnn=evidence.findIndex(item=>item.material?.url==='https://arxiv.org/abs/1710.10324' &&
    /connection of atoms|crystal graph/i.test(item.text));
  const alignn=evidence.findIndex(item=>item.material?.url==='https://arxiv.org/abs/2106.01829' &&
    /line graph corresponding to bond angles/i.test(item.text));
  if (cgcnn<0 || alignn<0) return;
  return {
    index:0,title:'CGCNN 的周期邻居与 ALIGNN 的键角例子',objective:'区分周期邻接、距离以及线图怎样编码键角。',
    explanation:'这两个设计回答不同的问题。构建晶体图时，周期邻居决定一条边连接到哪个原子或它的哪个晶胞副本。CGCNN 从晶体中的原子连接学习整体性质。ALIGNN 还在键图的线图上做消息传递：线图节点代表原子图的一条键，线图的边连接共享一个原子的两条键，角度编码放在这条线图边上。\n\n合成例子。设 B 在原点，A 在 (1,0,0)，第一种构型的 C 在 (0,1,0)，第二种构型的 C 在 (−1,0,0)。只保留 AB 和 BC 两条边，且两个构型的原子种类相同。两组边长都是 1，单看这两条边的标量距离无法区分构型；但 ∠ABC 分别为 90° 和 180°。在线图中，AB 与 BC 对应两个节点，连接它们的边可编码不同角度。如果原子图还包含 AC，两组 AC 的长度分别为 √2 和 2，三个距离也足以恢复夹角。这是局部表示的例子，不是对任何模型预测精度的比较。',
    prerequisites:[],evidence:[cgcnn,alignn],
    math:[
      { latex:String.raw`\cos\angle ABC=\frac{(\mathbf r_A-\mathbf r_B)\cdot(\mathbf r_C-\mathbf r_B)}{\|\mathbf r_A-\mathbf r_B\|\,\|\mathbf r_C-\mathbf r_B\|}`,explanation:'把两条向量都从 B 指向邻居。该例中两个向量的模均为 1，点积分别为 0 和 −1。' },
      { latex:String.raw`d_{AC}^{\,2}=d_{AB}^{\,2}+d_{BC}^{\,2}-2d_{AB}d_{BC}\cos\angle ABC`,explanation:'由余弦定理，在已知三边时可以反推 B 点的角度。' },
    ],
    practice:[{ question:'只保留 AB 与 BC 时，ALIGNN 在哪里编码 ∠ABC？',
      options:['原子图的 B 节点','线图里代表 AB 的节点','在线图中连接 AB 与 BC 的边'],answer:2,
      explanation:'线图中的两个节点各代表一条键。连接它们的边描述共享中心原子的键对，可携带夹角。' }],
  };
}
