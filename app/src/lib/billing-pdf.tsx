import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from "@react-pdf/renderer";
import { ServiceDescription } from "@/types";
import { firmDetails } from "./firm-details";
import { formatHours } from "./date-utils";

// Full Veda Legal logo component for PDF (octopus + text)
function VedaLogo({ height = 40 }: { height?: number }) {
  const scale = height / 33.7; // Original viewBox height
  return (
    <Svg width={83.89 * scale} height={33.7 * scale} viewBox="0 0 83.89 33.7">
      <Defs>
        <LinearGradient id="logo-gradient" x1="13.71" y1="0" x2="13.71" y2="33.7">
          <Stop offset="0.34" stopColor="#f99" />
          <Stop offset="1" stopColor="#f09" />
        </LinearGradient>
      </Defs>
      {/* Octopus */}
      <Path
        fill="url(#logo-gradient)"
        d="M25.71,26.3c-.55-.12-1.62,0-2.09-.32,.59-.14,2.03-.78,2.32-2.5,.07-.59-.17-2.21-2.01-2.5-.26-.04-1.05,.09-1.22,.75-.12,.5,.51,1.05,.92,.74-2.39,2.87-5.2,1.58-5.45,.86,.88-1.69,2.06-3.06,3.23-6.53,.59-1.97,.87-4.22,.66-6.8C21.38,3.99,14.65,.24,8.6,.01,5.15-.12,1.88,.81,.44,3.98c-2.57,7.14,6.94,10.38,9.24,12.16,2.68,2.03,4.07,3.34,4.62,4.84,.32,.85,.28,2.02,.25,2.43,0,0-.02,.02-.03,.03-.96,.18-3.47,.78-6.07-1.27,.55,.15,1.24,.11,1.49-.39,.22-1.05-.64-1.47-1.38-1.61-.92-.16-2.31,.51-2.43,1.98-.16,2,1.96,2.76,2.82,3.13-1.16,.29-3.07,.7-3.61,1.78-.19,.38-.52,1.23,.79,1.23,.96,.07,2.84-1.12,4.15,.03-.91,.4-3.34,1.05-2.84,2.34,.61,1.57,5.8,.36,7.38-.96,0,.91-1.36,3.24-.25,3.95,.98,.56,2.78-2.91,3.41-4.21,.84,.58,1.74,1.8,2.64,2.26,.91,.47,2.05,.71,2.58-.07,.38-.58,.15-1.06-.25-1.59-.41-.54-.98-.91-1.26-1.51,1.38,.13,5.17,.44,5.66-.55,.48-1.13-1.29-1.61-1.63-1.68h0Zm-6.63-13.14s1.09-1.39,1.23-1.24c.28,0,.63,.45,.7,.7,.28,.84,.41,1.7-.71,2.53-1.41,.97-1.69,.36-1.7,.32-.32-1.14,.47-2.3,.47-2.3h0Zm-2.8,2.93c-.4,.17-1.03,.18-1.74,.07-.76-.12-1.26-.41-1.68-.92-.43-.6-.66-1.31-.7-2.05-.11-.9,.29-1.6,.79-1.38l1.87,.84c.22,.11,1.2,.64,1.97,2.82,.05,.12-.09,.42-.53,.61h0Z"
      />
      {/* LEGAL text (small) */}
      <Path fill="#595959" d="M50.27,21.09v3.4h1.82v.82h-2.68v-4.21h.86Z" />
      <Path fill="#595959" d="M55.49,21.09v.82h-1.72v.76h1.09v.77h-1.09v1.05h1.89v.82h-2.75v-4.21h2.58Z" />
      <Path fill="#595959" d="M58.44,25.36c-1.54,0-2.42-.99-2.42-2.16s.86-2.16,2.37-2.16c1.13,0,1.83,.53,1.95,.61v.86c-.23-.15-.99-.65-1.93-.65s-1.47,.59-1.48,1.35c0,.77,.59,1.35,1.54,1.35,.37,0,.84-.12,1.09-.29v-1.11h.91v1.52c-.63,.48-1.22,.7-2,.7h-.01Z" />
      <Path fill="#595959" d="M62.09,24.3l-.52,1.01h-.95l2.21-4.22h.42l2.21,4.22h-.95l-.52-1.01h-1.89Zm1.55-.68l-.61-1.22-.6,1.22h1.21Z" />
      <Path fill="#595959" d="M66.86,21.09v3.4h1.82v.82h-2.68v-4.21h.86Z" />
      {/* VEDA text (large) */}
      <Path fill="#595959" d="M35.56,8.34c.16,0,.23,.04,.28,.16l4.43,7.86c.04,.08,.08,.1,.17,.1h.07c.08,0,.12-.01,.17-.1l4.4-7.86c.06-.11,.12-.16,.28-.16h1.44c.19,0,.23,.12,.14,.28l-4.81,8.57c-.38,.7-.73,.88-1.24,.88h-.67c-.61,0-.96-.18-1.34-.88l-4.86-8.57c-.08-.16-.04-.28,.14-.28h1.4Z" />
      <Path fill="#595959" d="M57.42,8.34c.17,0,.25,.08,.25,.25v1.07c0,.18-.08,.26-.25,.26h-6.08c-1.66,0-2.18,.53-2.18,2.21v.32h8.17c.17,0,.25,.07,.25,.25v.89c0,.17-.08,.25-.25,.25h-8.17v.43c0,1.68,.53,2.21,2.18,2.21h6.08c.17,0,.25,.08,.25,.26v1.07c0,.17-.08,.25-.25,.25h-6.09c-2.8,0-3.84-1-3.84-3.66v-2.39c0-2.66,1.06-3.66,3.84-3.66h6.09v-.02Z" />
      <Path fill="#595959" d="M66.18,8.34c2.99,0,4.2,1.21,4.2,3.91v1.88c0,2.71-1.22,3.91-4.2,3.91h-6.41c-.28,0-.42-.14-.42-.42V8.75c0-.28,.14-.42,.42-.42h6.41Zm-5.11,7.98c0,.11,.06,.17,.17,.17h4.89c1.86,0,2.51-.65,2.51-2.47v-1.61c0-1.82-.65-2.47-2.51-2.47h-4.89c-.11,0-.17,.06-.17,.17v6.21h0Z" />
      <Path fill="#595959" d="M77.65,8.34c.6,0,.95,.18,1.33,.88l4.86,8.57c.1,.17,.06,.28-.14,.28h-1.42c-.14,0-.2-.04-.28-.16l-1.09-1.96h-7.03l-1.08,1.96c-.06,.11-.12,.16-.28,.16h-1.45c-.18,0-.23-.11-.14-.28l4.82-8.57c.38-.7,.73-.88,1.22-.88h.67Zm-3.04,6.29h5.55l-2.57-4.58c-.06-.08-.1-.1-.17-.1h-.08c-.07,0-.11,.01-.17,.1l-2.57,4.58Z" />
    </Svg>
  );
}

// Brand colors
const colors = {
  coralPink: "#FF9999",
  coralPinkDark: "#CC7A7A", // Better contrast for print
  lightPink: "#fdf2f4",
  textPrimary: "#1a1a1a",
  textSecondary: "#4a4a4a",
  borderLight: "#e5e5e5",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 80, // Extra space for footer
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.textPrimary,
    position: "relative",
  },

  // Header section
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.coralPink,
  },
  logoContainer: {
    alignItems: "flex-end",
  },
  logoText: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    color: colors.coralPink,
    letterSpacing: 2,
  },
  logoSubtext: {
    fontSize: 10,
    color: colors.coralPinkDark,
    letterSpacing: 4,
    marginTop: -2,
  },

  // Title
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Client and document info row
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  clientDetail: {
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 1,
  },
  documentInfo: {
    alignItems: "flex-end",
  },
  documentLabel: {
    fontSize: 8,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  documentValue: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 4,
  },

  // Section titles
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Summary section
  summaryContainer: {
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryTopic: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  summaryAmount: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.coralPinkDark,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "bold",
  },
  totalAmount: {
    fontSize: 11,
    fontWeight: "bold",
  },
  vatNote: {
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: 2,
  },

  // Topic sections
  topicContainer: {
    marginTop: 12,
  },
  topicHeader: {
    backgroundColor: colors.coralPink,
    padding: 8,
    marginBottom: 1,
  },
  topicName: {
    fontFamily: "Helvetica-Bold",
    fontWeight: "bold",
    fontSize: 10,
    color: colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Table styles
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  tableRowAlt: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    backgroundColor: "#fafafa",
  },
  dateCol: {
    width: 55,
    fontSize: 9,
  },
  serviceCol: {
    flex: 1,
    fontSize: 9,
    paddingRight: 8,
  },
  timeCol: {
    width: 45,
    fontSize: 9,
    textAlign: "right",
  },

  // Topic footer
  topicFooter: {
    padding: 8,
    marginTop: 1,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  topicFooterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  topicFooterLabel: {
    width: 140,
    textAlign: "right",
    marginRight: 12,
    fontSize: 9,
    color: colors.textSecondary,
  },
  topicFooterValue: {
    width: 70,
    textAlign: "right",
    fontSize: 9,
  },
  topicFooterTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.coralPinkDark,
  },
  topicFooterTotalLabel: {
    width: 140,
    textAlign: "right",
    marginRight: 12,
    fontSize: 10,
    fontWeight: "bold",
  },
  topicFooterTotalValue: {
    width: 70,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "bold",
  },

  // Page footer
  pageFooter: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 10,
  },
  pageFooterContent: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  firmInfo: {
    flex: 1,
  },
  firmName: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.coralPinkDark,
    marginBottom: 2,
  },
  firmDetail: {
    fontSize: 7,
    color: colors.textSecondary,
    marginBottom: 1,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.textSecondary,
    textAlign: "right",
  },
});

// Exported for testing
export function formatCurrency(amount: number): string {
  return `€ ${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatPeriod(startStr: string): string {
  const start = new Date(startStr);
  return start
    .toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatDocumentDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function generateReference(data: ServiceDescription): string {
  const period = new Date(data.periodStart);
  const year = period.getFullYear();
  const month = String(period.getMonth() + 1).padStart(2, "0");
  // Use first 6 chars of ID as unique identifier
  const idPart = data.id.substring(0, 6).toUpperCase();
  return `SD-${year}${month}-${idPart}`;
}

export function calculateTopicTotal(topic: ServiceDescription["topics"][0]): number {
  let baseTotal: number;

  if (topic.pricingMode === "FIXED") {
    baseTotal = topic.fixedFee || 0;
  } else {
    const rawHours = topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
    const billedHours = topic.capHours ? Math.min(rawHours, topic.capHours) : rawHours;
    const hourlyTotal = billedHours * (topic.hourlyRate || 0);
    const fixedTotal = topic.lineItems.reduce((sum, item) => sum + (item.fixedAmount || 0), 0);
    baseTotal = hourlyTotal + fixedTotal;
  }

  if (topic.discountType === "PERCENTAGE" && topic.discountValue) {
    baseTotal = baseTotal * (1 - topic.discountValue / 100);
  } else if (topic.discountType === "AMOUNT" && topic.discountValue) {
    baseTotal = baseTotal - topic.discountValue;
  }

  return Math.max(baseTotal, 0);
}

export function calculateTopicHours(topic: ServiceDescription["topics"][0]): number {
  return topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
}

export function calculateGrandTotal(
  topics: ServiceDescription["topics"],
  discountType: "PERCENTAGE" | "AMOUNT" | null,
  discountValue: number | null,
): number {
  let subtotal = topics.reduce((sum, topic) => sum + calculateTopicTotal(topic), 0);

  if (discountType === "PERCENTAGE" && discountValue) {
    subtotal = subtotal * (1 - discountValue / 100);
  } else if (discountType === "AMOUNT" && discountValue) {
    subtotal = subtotal - discountValue;
  }

  return Math.max(subtotal, 0);
}

export function calculateTopicBaseTotal(topic: ServiceDescription["topics"][0]): number {
  if (topic.pricingMode === "FIXED") {
    return topic.fixedFee || 0;
  }
  const rawHours = topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
  const billedHours = topic.capHours ? Math.min(rawHours, topic.capHours) : rawHours;
  const hourlyTotal = billedHours * (topic.hourlyRate || 0);
  const fixedTotal = topic.lineItems.reduce((sum, item) => sum + (item.fixedAmount || 0), 0);
  return hourlyTotal + fixedTotal;
}

interface ServiceDescriptionPDFProps {
  data: ServiceDescription;
}

export function ServiceDescriptionPDF({ data }: ServiceDescriptionPDFProps) {
  const subtotal = data.topics.reduce(
    (sum, topic) => sum + calculateTopicTotal(topic),
    0
  );
  const grandTotal = calculateGrandTotal(data.topics, data.discountType, data.discountValue);
  const hasOverallDiscount = data.discountType && data.discountValue;
  const reference = generateReference(data);
  const documentDate = formatDocumentDate();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo */}
        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }} />
          <View style={styles.logoContainer}>
            <VedaLogo height={36} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Description of Legal Services</Text>

        {/* Client and document info */}
        <View style={styles.infoRow}>
          <View style={styles.clientInfo}>
            <Text style={styles.clientName}>
              {data.client.invoicedName || data.client.name}
            </Text>
            {data.client.invoiceAttn && (
              <Text style={styles.clientDetail}>
                Attn: {data.client.invoiceAttn}
              </Text>
            )}
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentLabel}>Reference</Text>
            <Text style={styles.documentValue}>{reference}</Text>
            <Text style={styles.documentLabel}>Period</Text>
            <Text style={styles.documentValue}>
              {formatPeriod(data.periodStart)}
            </Text>
            <Text style={styles.documentLabel}>Date</Text>
            <Text style={styles.documentValue}>{documentDate}</Text>
          </View>
        </View>

        {/* Summary section */}
        <Text style={styles.sectionTitle}>Summary of Fees</Text>
        <View style={styles.summaryContainer}>
          {data.topics.map((topic) => (
            <View key={topic.id} style={styles.summaryRow}>
              <Text style={styles.summaryTopic}>{topic.topicName}</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(calculateTopicTotal(topic))}
              </Text>
            </View>
          ))}
          {hasOverallDiscount && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTopic}>Subtotal</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrency(subtotal)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTopic}>
                  Overall Discount ({data.discountType === "PERCENTAGE"
                    ? `${data.discountValue}%`
                    : formatCurrency(data.discountValue!)})
                </Text>
                <Text style={styles.summaryAmount}>
                  -{formatCurrency(
                    data.discountType === "PERCENTAGE"
                      ? subtotal * data.discountValue! / 100
                      : data.discountValue!
                  )}
                </Text>
              </View>
            </>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Fees</Text>
            <Text style={styles.totalAmount}>{formatCurrency(grandTotal)}</Text>
          </View>
          <Text style={styles.vatNote}>All amounts exclude VAT</Text>
        </View>

        {/* Detailed services section */}
        <Text style={styles.sectionTitle}>Detailed Description of Services</Text>

        {/* Topic sections */}
        {data.topics.map((topic) => {
          const totalHours = calculateTopicHours(topic);
          const baseTopicTotal = calculateTopicBaseTotal(topic);
          const topicTotal = calculateTopicTotal(topic);
          const hasTopicDiscount = topic.discountType && topic.discountValue;
          const isCapped = topic.pricingMode === "HOURLY" && topic.capHours && totalHours > topic.capHours;

          return (
            <View key={topic.id} style={styles.topicContainer}>
              {/* Topic name header */}
              <View style={styles.topicHeader}>
                <Text style={styles.topicName}>{topic.topicName}</Text>
              </View>

              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.dateCol]}>
                  Date
                </Text>
                <Text style={[styles.tableHeaderText, styles.serviceCol]}>
                  Service Description
                </Text>
                <Text style={[styles.tableHeaderText, styles.timeCol]}>
                  Time
                </Text>
              </View>

              {/* Line items with zebra striping */}
              {topic.lineItems.map((item, index) => (
                <View
                  key={item.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  wrap={false}
                >
                  <Text style={styles.dateCol}>{formatDate(item.date)}</Text>
                  <Text style={styles.serviceCol}>{item.description}</Text>
                  <Text style={styles.timeCol}>
                    {item.hours ? formatHours(item.hours) : "—"}
                  </Text>
                </View>
              ))}

              {/* Topic footer with totals */}
              <View style={styles.topicFooter}>
                <View style={styles.topicFooterRow}>
                  <Text style={styles.topicFooterLabel}>
                    Total Time:
                  </Text>
                  <Text style={styles.topicFooterValue}>
                    {isCapped
                      ? `${formatHours(topic.capHours!)} (capped from ${formatHours(totalHours)})`
                      : formatHours(totalHours)}
                  </Text>
                </View>
                {topic.pricingMode === "HOURLY" ? (
                  <>
                    <View style={styles.topicFooterRow}>
                      <Text style={styles.topicFooterLabel}>
                        Hourly Rate (excl. VAT):
                      </Text>
                      <Text style={styles.topicFooterValue}>
                        {formatCurrency(topic.hourlyRate || 0)}
                      </Text>
                    </View>
                    {hasTopicDiscount ? (
                      <>
                        <View style={styles.topicFooterRow}>
                          <Text style={styles.topicFooterLabel}>Subtotal:</Text>
                          <Text style={styles.topicFooterValue}>
                            {formatCurrency(baseTopicTotal)}
                          </Text>
                        </View>
                        <View style={styles.topicFooterRow}>
                          <Text style={styles.topicFooterLabel}>
                            Discount ({topic.discountType === "PERCENTAGE"
                              ? `${topic.discountValue}%`
                              : formatCurrency(topic.discountValue!)}):
                          </Text>
                          <Text style={styles.topicFooterValue}>
                            -{formatCurrency(
                              topic.discountType === "PERCENTAGE"
                                ? baseTopicTotal * topic.discountValue! / 100
                                : topic.discountValue!
                            )}
                          </Text>
                        </View>
                        <View style={styles.topicFooterTotal}>
                          <Text style={styles.topicFooterTotalLabel}>
                            Topic Fee:
                          </Text>
                          <Text style={styles.topicFooterTotalValue}>
                            {formatCurrency(topicTotal)}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.topicFooterTotal}>
                        <Text style={styles.topicFooterTotalLabel}>
                          Topic Fee:
                        </Text>
                        <Text style={styles.topicFooterTotalValue}>
                          {formatCurrency(topicTotal)}
                        </Text>
                      </View>
                    )}
                  </>
                ) : hasTopicDiscount ? (
                  <>
                    <View style={styles.topicFooterRow}>
                      <Text style={styles.topicFooterLabel}>Subtotal:</Text>
                      <Text style={styles.topicFooterValue}>
                        {formatCurrency(baseTopicTotal)}
                      </Text>
                    </View>
                    <View style={styles.topicFooterRow}>
                      <Text style={styles.topicFooterLabel}>
                        Discount ({topic.discountType === "PERCENTAGE"
                          ? `${topic.discountValue}%`
                          : formatCurrency(topic.discountValue!)}):
                      </Text>
                      <Text style={styles.topicFooterValue}>
                        -{formatCurrency(
                          topic.discountType === "PERCENTAGE"
                            ? baseTopicTotal * topic.discountValue! / 100
                            : topic.discountValue!
                        )}
                      </Text>
                    </View>
                    <View style={styles.topicFooterTotal}>
                      <Text style={styles.topicFooterTotalLabel}>
                        Fixed Fee:
                      </Text>
                      <Text style={styles.topicFooterTotalValue}>
                        {formatCurrency(topicTotal)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.topicFooterTotal}>
                    <Text style={styles.topicFooterTotalLabel}>
                      Fixed Fee:
                    </Text>
                    <Text style={styles.topicFooterTotalValue}>
                      {formatCurrency(topicTotal)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* Page footer with firm details */}
        <View style={styles.pageFooter} fixed>
          <View style={styles.pageFooterContent}>
            <View style={styles.firmInfo}>
              <Text style={styles.firmName}>{firmDetails.fullName}</Text>
              <Text style={styles.firmDetail}>
                {firmDetails.address} | {firmDetails.city}
              </Text>
              <Text style={styles.firmDetail}>
                {firmDetails.email} | {firmDetails.website}
              </Text>
              <Text style={styles.firmDetail}>
                VAT: {firmDetails.vatNumber} | Reg: {firmDetails.registrationNumber}
              </Text>
            </View>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
