🎯 Purpose
To provide the Lyria prompt-writer with the authentic musical DNA, technical Maqam structures, and precise lyrical Tashkeel of classic Iraqi masterpieces. The agent MUST NOT "hallucinate" or guess style; it must reconstruct based on these designs.
🏗️ Design Protocol for the AI Agent
When the system queries these files, the AI must follow this strict "Design Workflow":
Lyrical Authority:
Always use the lyrics from these files exactly as written.
CRITICAL: Preserve the Tashkeel (vowels). These are not just for reading; they define the rhythmic "swing" and pronunciation for the Lyria engine.
Instrumental Mapping:
Instead of generic "Arabic instruments," extract the specific lead instruments mentioned (e.g., Santur vs Qanun, Joza vs Violin).
If a file mentions a "Takht" style, design the song for a small acoustic ensemble. If it mentions "70s Strings," design for a large orchestral feel.
Maqam Grounding:
The Maqam identified in these files is the primary constraint.
If the user asks for a "New Sad Song," the agent must look for files tagged with Maqam Lami or Maqam Dasht and copy the melodic behavior (Sair) described in those files.
Rhythmic Fidelity (Iqa'):
The Iqa' (e.g., Jobi, Basta, Georgina) defines the drum patterns. Use the technical percussion descriptions (e.g., "Heavy Khashaba," "Metallic Riq") to build the sound prompt.
📝 File Structure Reference
Each <song-id>.txt contains:
tags: Key metadata for RAG retrieval.
technical_analysis: The musical blueprint (Maqam, Iqa', Instruments).
vocal_description: The texture and emotional delivery of the singer.
lyrics_tashkeel: The full poem with vowels.
lyria_descriptor: A pre-designed technical paragraph for the model.
🚫 Constraints
NO Generic Outputs: Do not use western musical terms if a traditional Iraqi term is available in the RAG.
Era Matching: Ensure the production vibe (e.g., "Warm Analog 1970s") matches the era of the song being referenced in the design.