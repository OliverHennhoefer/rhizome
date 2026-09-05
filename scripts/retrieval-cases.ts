export interface RetrievalCase {
  id: string;
  corpus: "vault" | "kitchen" | "systems";
  split: "development" | "held-out";
  query: string;
  relevant: string[];
  first: boolean;
}

// Labels are fixed before changing the search implementation. Every tenth group
// contributes its final three cases to the held-out set (30 of 100 overall).
const vault: Array<[string, string[], boolean?]> = [
  ["AdamW", ["Learning/AdamW"], true],
  ["GQA", ["Attention/Grouped-query attention"], true],
  ["Attention", ["Attention/Attention"], true],
  ["Transformer block", ["Transformer/Transformer block"], true],
  ["LayerNorm", ["Neural networks/Layer normalization"], true],
  ["RMSNorm", ["Neural networks/RMS normalization"], true],
  ["RoPE", ["Attention/Rotary position embeddings"], true],
  ["BPE", ["Language/Subword tokenization"], true],
  ["SwiGLU", ["Neural networks/Gated MLPs and SwiGLU"], true],
  ["KV cache", ["Transformer/KV cache"], true],
  ["What does this vault say about photosynthesis?", []],
  ["According to these notes, how does plate tectonics work?", []],
  [
    "Find the note whose alias is GQA and give its canonical title.",
    ["Attention/Grouped-query attention"],
    true,
  ],
  ["What is the immediate downstream impact of changing attention?", ["Attention/Attention"], true],
  [
    "What does the vault say about decoupled weight decay?",
    ["Learning/AdamW", "Learning/Optimizers", "Sources/Decoupled Weight Decay Regularization"],
  ],
  [
    "Find a path-related note about normalization and summarize it.",
    [
      "Transformer/Pre-normalization",
      "Neural networks/Layer normalization",
      "Neural networks/RMS normalization",
    ],
  ],
  ["What does a Transformer block depend on?", ["Transformer/Transformer block"], true],
  ["What directly depends on the Transformer block?", ["Transformer/Transformer block"], true],
  [
    "Compare grouped-query attention with multi-head attention",
    ["Attention/Grouped-query attention", "Attention/Multi-head attention"],
  ],
  ["Explain residual connections from the notes", ["Neural networks/Residual connections"], true],
  ["What is the vault's guidance on sourdough fermentation?", []],
  ["What do these notes say about medieval heraldry?", []],
  ["Learning/AdamW.md", ["Learning/AdamW"], true],
  ["Attention/Grouped-query attention", ["Attention/Grouped-query attention"], true],
  [
    "Foundations/Linear algebra",
    [
      "Foundations/Linear algebra/Matrices",
      "Foundations/Linear algebra/Vectors",
      "Foundations/Linear algebra/Matrix multiplication",
    ],
  ],
  [
    "modern-refinement",
    [
      "Attention/Grouped-query attention",
      "Attention/Rotary position embeddings",
      "Neural networks/RMS normalization",
      "Neural networks/Gated MLPs and SwiGLU",
      "Transformer/Mixture of experts",
    ],
  ],
  ["Transformer paper", ["Sources/Attention Is All You Need"], true],
  ["AdamW paper", ["Sources/Decoupled Weight Decay Regularization"], true],
  [
    "GQA paper",
    [
      "Sources/GQA - Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints",
    ],
    true,
  ],
  ["arXiv 1706.03762", ["Sources/Attention Is All You Need"], true],
  ["Explain the vault's findings about volcanoes", []],
  ["What does this knowledge base say about Byzantine pottery?", []],
  ["transfomer block", ["Transformer/Transformer block"]],
  ["backpropagtion", ["Learning/Backpropagation"]],
  [
    "normaliz",
    [
      "Neural networks/Layer normalization",
      "Neural networks/RMS normalization",
      "Transformer/Pre-normalization",
      "Sources/Root Mean Square Layer Normalization",
    ],
  ],
  ["optmizers", ["Learning/Optimizers"]],
  ["What is causal masking?", ["Attention/Causal masking"], true],
  ["Explain the chain rule of probability", ["Language/Autoregressive factorization"], true],
  ["How does key-value cache work?", ["Transformer/KV cache"], true],
  ["What is a feed-forward network?", ["Neural networks/Multilayer perceptrons"], true],
  ["Tell me the vault's recommendations for beekeeping", []],
  ["Find information about baroque counterpoint in these notes", []],
  ["What are logits?", ["Neural networks/Softmax and logits"], true],
  ["Compute-optimal scaling", ["Transformer/Scaling laws"], true],
  ["Next token prediction", ["Language/Next-token prediction"], true],
  ["Skip connection", ["Neural networks/Residual connections"], true],
  ["What does the vault say about temperature?", ["Transformer/Temperature"], true],
  ["Explain nucleus sampling", ["Transformer/Top-k and nucleus sampling"], true],
  [
    "What is the Chinchilla paper?",
    ["Sources/Training Compute-Optimal Large Language Models"],
    true,
  ],
  ["Explain prefill and decoding", ["Transformer/Prefill and decoding"], true],
  ["What does the vault say about paleontology?", []],
  ["Find the notes about viticulture", []],
  ["Which notes discuss gradient descent?", ["Learning/Gradient descent"], true],
  ["Explain cosine similarity", ["Foundations/Linear algebra/Norm and cosine similarity"], true],
  ["How does the vault define expected value?", ["Foundations/Probability/Expectation"], true],
  [
    "What does the vault say about tensor shape?",
    ["Foundations/Linear algebra/Shape and dimension"],
    true,
  ],
  [
    "Compare LayerNorm and RMSNorm",
    ["Neural networks/Layer normalization", "Neural networks/RMS normalization"],
  ],
  [
    "Compare SGD with AdamW",
    ["Learning/Mini-batches and stochastic gradient descent", "Learning/AdamW"],
  ],
  ["Explain mineralogy using these notes", []],
  ["What does the vault say about origami?", []],
];

const kitchen: Array<[string, string[], boolean?]> = [
  ["Sourdough", ["Baking/Sourdough"], true],
  ["Wild yeast bread", ["Baking/Sourdough"], true],
  ["How should I maintain a sourdough starter?", ["Baking/Sourdough"], true],
  ["lactic acid bacteria tangy aroma", ["Baking/Sourdough"]],
  ["Baker percentages", ["Baking/Baker percentages"], true],
  ["Dough ratios", ["Baking/Baker percentages"], true],
  ["750 grams water 1000 grams flour", ["Baking/Baker percentages"]],
  ["Vegetable fermentation", ["Pantry/Fermentation"], true],
  ["Lacto-fermentation", ["Pantry/Fermentation"], true],
  ["shredded cabbage submerged brine", ["Pantry/Fermentation"]],
  ["What do these recipes say about cryptocurrency?", []],
  ["Explain astrophysics according to this vault", []],
  ["Cold brew", ["Drinks/Cold brew"], true],
  ["Coffee concentrate", ["Drinks/Cold brew"], true],
  ["coarse grounds cool water overnight", ["Drinks/Cold brew"]],
  ["Baking/Sourdough.md", ["Baking/Sourdough"], true],
  ["sourdouh", ["Baking/Sourdough"]],
  ["fermentation", ["Pantry/Fermentation", "Baking/Sourdough"]],
  ["What does this vault say about immunotherapy?", []],
  ["Find notes on cartography", []],
];

const systems: Array<[string, string[], boolean?]> = [
  ["C++", ["Languages/CPP"], true],
  ["C#", ["Languages/CSharp"], true],
  ["Explain C++ resource lifetime", ["Languages/CPP"], true],
  ["How does C# dispose a resource?", ["Languages/CSharp"], true],
  ["std::unique_ptr", ["Languages/CPP"]],
  ["RAII destructors owned resources", ["Languages/CPP"]],
  ["garbage collector unreachable managed objects", ["Languages/CSharp"]],
  ["Storage cache", ["Storage/Cache"], true],
  ["HTTP cache", ["HTTP/Cache"], true],
  ["Cache", ["HTTP/Cache", "Storage/Cache"]],
  ["What do these notes say about acupuncture?", []],
  ["Explain ornithology using this vault", []],
  ["byte budget retained memory", ["Storage/Cache"]],
  ["stampedes concurrent expired value", ["Storage/Cache"]],
  ["ETag conditionally revalidate representation", ["HTTP/Cache"]],
  ["304 unchanged body", ["HTTP/Cache"]],
  ["Languages/CSharp.md", ["Languages/CSharp"], true],
  ["destrctors", ["Languages/CPP"]],
  ["Find the vault's notes on archaeology", []],
  ["What do these notes say about entomology?", []],
];

export const retrievalCases: RetrievalCase[] = Object.entries({ vault, kitchen, systems }).flatMap(
  ([corpus, cases]) =>
    cases.map(([query, relevant, first = false], index) => ({
      id: `${corpus}-${String(index + 1).padStart(2, "0")}`,
      corpus: corpus as RetrievalCase["corpus"],
      split: index % 10 >= 7 ? ("held-out" as const) : ("development" as const),
      query,
      relevant,
      first,
    })),
);
