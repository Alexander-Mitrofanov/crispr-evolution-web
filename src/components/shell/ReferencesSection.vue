<script setup>
import { ref } from "vue";
import AppIcon from "../common/AppIcon.vue";

const disclosure = ref(null);
defineExpose({
  open() {
    disclosure.value.open = true;
    disclosure.value.scrollIntoView({ block: "start" });
    disclosure.value.querySelector("summary")?.focus({ preventScroll: true });
  },
});

const citations = [
  {
    tool: "CCTK",
    authors: "Collins et al.",
    venue: "The CRISPR Journal · 2023",
    title: "CRISPR comparison toolkit",
    doi: "https://doi.org/10.1089/crispr.2022.0080",
    note: "Observed spacer order and set-based sharing; comparison is distinct from evolutionary reconstruction.",
    source: "https://github.com/Alan-Collins/CRISPR_comparison_toolkit",
  },
  {
    tool: "SpacePHARER",
    authors: "Zhang et al.",
    venue: "Bioinformatics · 2021",
    title:
      "SpacePHARER: sensitive identification of phages from CRISPR spacers in prokaryotic hosts",
    doi: "https://doi.org/10.1093/bioinformatics/btab222",
    source: "https://github.com/soedinglab/spacepharer",
    note: "Group–target association evidence from translated and nucleotide searches, with empirical target/control calibration.",
  },
  {
    tool: "CRISPRidentify",
    authors: "Mitrofanov et al.",
    venue: "Nucleic Acids Research · 2021",
    title: "CRISPRidentify: identification of CRISPR arrays using machine learning approach",
    doi: "https://doi.org/10.1093/nar/gkaa1158",
    source: "https://github.com/BackofenLab/CRISPRidentify",
  },
  {
    tool: "CasAndra",
    authors: "Makarova et al.",
    venue: "Nature Microbiology · 2025",
    title: "An updated evolutionary classification of CRISPR–Cas systems including rare variants",
    doi: "https://doi.org/10.1038/s41564-025-02180-8",
    note: "CRISPR–Cas classification reference used by CasAndra.",
  },
  {
    tool: "CRISPRtracrRNA",
    authors: "Mitrofanov et al.",
    venue: "Bioinformatics · 2022",
    title: "CRISPRtracrRNA: robust approach for CRISPR tracrRNA detection",
    doi: "https://doi.org/10.1093/bioinformatics/btac466",
    source: "https://github.com/BackofenLab/CRISPRtracrRNA",
  },
  {
    tool: "CRISPRleader",
    authors: "Alkhnbashi et al.",
    venue: "Bioinformatics · 2016",
    title: "Characterizing leader sequences of CRISPR loci",
    doi: "https://doi.org/10.1093/bioinformatics/btw454",
    source: "https://github.com/BackofenLab/CRISPRleader",
  },
  {
    tool: "CRISPRrepeat",
    authors: "Lorenz et al.",
    venue: "Algorithms for Molecular Biology · 2011",
    title: "ViennaRNA Package 2.0",
    doi: "https://doi.org/10.1186/1748-7188-6-26",
    source: "https://github.com/ViennaRNA/ViennaRNA",
    sourceLabel: "ViennaRNA source",
    note: "Folding method used by CRISPRrepeat.",
  },
  {
    tool: "RepeatTyper / CRISPRCasTyper",
    authors: "Russel et al.",
    venue: "The CRISPR Journal · 2020",
    title:
      "CRISPRCasTyper: Automated Identification, Annotation, and Classification of CRISPR-Cas Loci",
    doi: "https://doi.org/10.1089/crispr.2020.0059",
    source: "https://github.com/Alexander-Mitrofanov/RepeatTyper",
    note: "Standalone repeat classifier with the preserved 37-label model. Closed-set scores are not calibrated confidence.",
  },
  {
    tool: "CRISPRmap",
    authors: "Lange et al.",
    venue: "Nucleic Acids Research · 2013",
    title:
      "CRISPRmap: an automated classification of repeat conservation in prokaryotic adaptive immune systems",
    doi: "https://doi.org/10.1093/nar/gkt606",
    source: "https://rna.informatik.uni-freiburg.de/CRISPRmap/",
    sourceLabel: "Original website",
  },
  {
    tool: "CRISPRspacer",
    authors: "Alkhnbashi et al.",
    venue: "Nucleic Acids Research · 2021",
    title: "CRISPRloci: comprehensive and accurate annotation of CRISPR–Cas systems",
    doi: "https://doi.org/10.1093/nar/gkab456",
    source: "https://github.com/BackofenLab/CRISPRloci",
    note: "Original web-server and spacer-analysis reference.",
  },
  {
    tool: "BLAST+",
    authors: "Camacho et al.",
    venue: "BMC Bioinformatics · 2009",
    title: "BLAST+: architecture and applications",
    doi: "https://doi.org/10.1186/1471-2105-10-421",
    note: "Sequence search method used by CRISPRspacer and CRISPRtracrRNA.",
  },
  {
    tool: "SpacerPlacer",
    authors: "Fehrenbach et al.",
    venue: "Nucleic Acids Research · 2024",
    title:
      "SpacerPlacer: ancestral reconstruction of CRISPR arrays reveals the evolutionary dynamics of spacer deletions",
    doi: "https://doi.org/10.1093/nar/gkae772",
    source: "https://github.com/fbaumdicker/SpacerPlacer",
  },
  {
    tool: "CRISPR-evOr",
    authors: "Fehrenbach et al.",
    venue: "PLOS Computational Biology · 2025",
    title: "An evolutionary approach to predict the orientation of CRISPR arrays",
    doi: "https://doi.org/10.1371/journal.pcbi.1013706",
    source: "https://github.com/fbaumdicker/SpacerPlacer",
  },
];
</script>

<template>
  <section
    id="references"
    class="references"
    aria-labelledby="references-heading"
  >
    <details ref="disclosure">
      <summary id="references-heading">References</summary>
      <div class="reference-grid">
        <article
          v-for="item in citations"
          :key="item.tool"
        >
          <span>{{ item.authors }} · {{ item.venue }}</span>
          <h3>{{ item.tool }}</h3>
          <p>{{ item.title }}</p>
          <p v-if="item.note">{{ item.note }}</p>
          <div>
            <a
              :href="item.doi"
              target="_blank"
              rel="noopener noreferrer"
              >Publication
              <AppIcon
                name="external"
                :size="15" /></a
            ><a
              v-if="item.source"
              :href="item.source"
              target="_blank"
              rel="noopener noreferrer"
              >{{ item.sourceLabel || "Original source" }}
              <AppIcon
                name="external"
                :size="15"
            /></a>
          </div>
        </article>
      </div>
    </details>
  </section>
</template>
