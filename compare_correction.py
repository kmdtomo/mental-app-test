#!/usr/bin/env python3
"""補正あり/なしを比較"""
import sys
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

# 実際のinference_coreの動作を再現
from inference import inference_core

print("=== 補正値の影響を可視化 ===\n")

# Youden Index補正値
yi_ang, yi_hap, yi_sad = 0.25940862, 0.58535635, 0.20732406

# いくつかの仮想的な生の出力値でテスト
test_cases = [
    # 喜びが最も高い場合
    {"name": "喜び優位", "ang": 2.0, "hap": 4.0, "sad": 2.5},
    # 怒りが最も高い場合
    {"name": "怒り優位", "ang": 4.0, "hap": 2.0, "sad": 2.5},
    # 悲しみが最も高い場合
    {"name": "悲しみ優位", "ang": 2.0, "hap": 2.5, "sad": 4.0},
    # すべて同じ場合
    {"name": "全て同値", "ang": 3.0, "hap": 3.0, "sad": 3.0},
    # 実際によくある値
    {"name": "典型的な値", "ang": 3.2, "hap": 3.3, "sad": 3.1},
]

def judge_simple(values):
    """最も高い値の感情を返す"""
    return max(values, key=values.get)

for case in test_cases:
    print(f"\n【{case['name']}】")
    print(f"生の値: ang={case['ang']:.1f}, hap={case['hap']:.1f}, sad={case['sad']:.1f}")
    
    # 補正なし
    no_corr = {"ang": case['ang'], "hap": case['hap'], "sad": case['sad']}
    result_no_corr = judge_simple(no_corr)
    
    # 補正あり
    with_corr = {
        "ang": case['ang'] - yi_ang,
        "hap": case['hap'] - yi_hap,
        "sad": case['sad'] - yi_sad
    }
    result_with_corr = judge_simple(with_corr)
    
    print(f"補正なし → {result_no_corr}")
    print(f"補正あり: ang={with_corr['ang']:.2f}, hap={with_corr['hap']:.2f}, sad={with_corr['sad']:.2f} → {result_with_corr}")
    
    if result_no_corr != result_with_corr:
        print("⚠️  補正で結果が変わった！")

print("\n\n=== 結論 ===")
print(f"補正値の大きさ:")
print(f"  ang: -{yi_ang:.3f}")
print(f"  hap: -{yi_hap:.3f} ← 他の約3倍！")
print(f"  sad: -{yi_sad:.3f}")
print(f"\nこの補正により、喜び(hap)が極端に下がりやすくなっています。")