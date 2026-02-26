import React from "react";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { ServiceDescription } from "@/types";
import { firmDetails } from "./firm-details";
import { formatHours } from "./date-utils";

// Pre-rendered PNG with gradient for reliable PDF rendering
const logoPath = path.join(process.cwd(), "public", "logo-print.png");

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

export function calculateTopicBaseTotal(topic: ServiceDescription["topics"][0]): number {
  if (topic.pricingMode === "FIXED") {
    return topic.fixedFee || 0;
  }
  const billableItems = topic.lineItems.filter((item) => item.waiveMode !== "EXCLUDED");
  const rawHours = billableItems.reduce(
    (sum, item) => sum + (item.waiveMode === "ZERO" ? 0 : (item.hours || 0)),
    0
  );
  const billedHours = topic.capHours ? Math.min(rawHours, topic.capHours) : rawHours;
  const hourlyTotal = billedHours * (topic.hourlyRate || 0);
  return Math.round(hourlyTotal * 100) / 100;
}

export function calculateTopicTotal(topic: ServiceDescription["topics"][0]): number {
  let total = calculateTopicBaseTotal(topic);

  if (topic.discountType === "PERCENTAGE" && topic.discountValue) {
    total = total * (1 - topic.discountValue / 100);
  } else if (topic.discountType === "AMOUNT" && topic.discountValue) {
    total = total - topic.discountValue;
  }

  return Math.round(Math.max(total, 0) * 100) / 100;
}

export function calculateTopicHours(topic: ServiceDescription["topics"][0]): number {
  return topic.lineItems.reduce(
    (sum, item) => {
      if (item.waiveMode === "EXCLUDED") return sum;
      if (item.waiveMode === "ZERO") return sum;
      return sum + (item.hours || 0);
    },
    0
  );
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

  return Math.round(Math.max(subtotal, 0) * 100) / 100;
}

/**
 * Retainer billing summary. Returned by calculateRetainerSummary for use
 * by both the UI summary panel and the PDF renderer.
 */
export interface RetainerSummary {
  /** Sum of billable hours from all HOURLY topics (excl. waived) */
  totalHourlyHours: number;
  /** Hours included in the retainer */
  retainerHours: number;
  /** The flat retainer fee */
  retainerFee: number;
  /** Hours exceeding the retainer (0 if under) */
  overageHours: number;
  /** Rate used for overage calculation */
  overageRate: number;
  /** overageHours * overageRate */
  overageAmount: number;
  /** Sum of FIXED topic fees (billed separately from retainer) */
  fixedTopicFees: number;
  /** retainerCharge + fixedTopicFees (before SD discount) */
  subtotal: number;
  /** Final total after SD-level discount */
  grandTotal: number;
}

/**
 * Calculates the full retainer billing breakdown for a service description.
 *
 * Rules:
 * - HOURLY topic hours count against retainer included hours
 * - FIXED topic fees are billed separately on top of retainer
 * - Waived items (EXCLUDED/ZERO) do NOT count toward retainer hours
 * - Topic-level caps and discounts are ignored in retainer mode
 * - SD-level discount applies to the final total
 */
export function calculateRetainerSummary(
  topics: ServiceDescription["topics"],
  retainerFee: number,
  retainerHours: number,
  overageRate: number,
  discountType: "PERCENTAGE" | "AMOUNT" | null,
  discountValue: number | null,
): RetainerSummary {
  let totalHourlyHours = 0;
  let fixedTopicFees = 0;

  for (const topic of topics) {
    if (topic.pricingMode === "FIXED") {
      fixedTopicFees += topic.fixedFee || 0;
      continue;
    }

    // HOURLY topic — count hours toward retainer
    for (const item of topic.lineItems) {
      if (item.waiveMode === "EXCLUDED") continue;
      if (item.waiveMode === "ZERO") continue;
      totalHourlyHours += item.hours || 0;
    }
  }

  const overageHours = Math.max(0, totalHourlyHours - retainerHours);
  const overageAmount = Math.round(overageHours * overageRate * 100) / 100;
  const retainerCharge = retainerFee + overageAmount;

  fixedTopicFees = Math.round(fixedTopicFees * 100) / 100;

  let subtotal = retainerCharge + fixedTopicFees;
  subtotal = Math.round(subtotal * 100) / 100;

  let grandTotal = subtotal;
  if (discountType === "PERCENTAGE" && discountValue) {
    grandTotal = subtotal * (1 - discountValue / 100);
  } else if (discountType === "AMOUNT" && discountValue) {
    grandTotal = subtotal - discountValue;
  }
  grandTotal = Math.round(Math.max(grandTotal, 0) * 100) / 100;

  return {
    totalHourlyHours,
    retainerHours,
    retainerFee,
    overageHours,
    overageRate,
    overageAmount,
    fixedTopicFees,
    subtotal,
    grandTotal,
  };
}

/**
 * Convenience function that returns just the grand total for retainer billing.
 * Used by the billing list API to compute totalAmount per SD.
 */
export function calculateRetainerGrandTotal(
  topics: ServiceDescription["topics"],
  retainerFee: number,
  retainerHours: number,
  overageRate: number,
  discountType: "PERCENTAGE" | "AMOUNT" | null,
  discountValue: number | null,
): number {
  return calculateRetainerSummary(
    topics, retainerFee, retainerHours, overageRate, discountType, discountValue,
  ).grandTotal;
}

interface ServiceDescriptionPDFProps {
  data: ServiceDescription;
}

export function ServiceDescriptionPDF({ data }: ServiceDescriptionPDFProps) {
  const isRetainer = data.retainerFee != null && data.retainerHours != null;
  const retainerSummary = isRetainer
    ? calculateRetainerSummary(
        data.topics,
        data.retainerFee!,
        data.retainerHours!,
        data.retainerOverageRate || 0,
        data.discountType,
        data.discountValue,
      )
    : null;

  const subtotal = isRetainer
    ? retainerSummary!.subtotal
    : data.topics.reduce((sum, topic) => sum + calculateTopicTotal(topic), 0);
  const grandTotal = isRetainer
    ? retainerSummary!.grandTotal
    : calculateGrandTotal(data.topics, data.discountType, data.discountValue);
  const hasOverallDiscount = data.discountType && data.discountValue;
  const documentDate = formatDocumentDate();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo */}
        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }} />
          <View style={styles.logoContainer}>
            <Image src={logoPath} style={{ height: 36, width: 90 }} />
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
          {isRetainer && retainerSummary ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTopic}>Monthly Retainer</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrency(retainerSummary.retainerFee)}
                </Text>
              </View>
              {retainerSummary.overageHours > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTopic}>
                    Overage: {formatHours(retainerSummary.overageHours)} at {formatCurrency(retainerSummary.overageRate)}/hr
                  </Text>
                  <Text style={styles.summaryAmount}>
                    {formatCurrency(retainerSummary.overageAmount)}
                  </Text>
                </View>
              )}
              {retainerSummary.fixedTopicFees > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTopic}>Fixed Fees</Text>
                  <Text style={styles.summaryAmount}>
                    {formatCurrency(retainerSummary.fixedTopicFees)}
                  </Text>
                </View>
              )}
              {hasOverallDiscount && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryTopic}>Subtotal</Text>
                    <Text style={styles.summaryAmount}>
                      {formatCurrency(retainerSummary.subtotal)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryTopic}>
                      Overall Discount ({data.discountType === "PERCENTAGE"
                        ? `${data.discountValue}%`
                        : formatCurrency(data.discountValue!)})
                    </Text>
                    <Text style={styles.summaryAmount}>
                      -{formatCurrency(retainerSummary.subtotal - retainerSummary.grandTotal)}
                    </Text>
                  </View>
                </>
              )}
            </>
          ) : (
            <>
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
                      -{formatCurrency(subtotal - grandTotal)}
                    </Text>
                  </View>
                </>
              )}
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
        {data.topics.map((topic, topicIndex) => {
          const totalHours = calculateTopicHours(topic);
          const baseTopicTotal = calculateTopicBaseTotal(topic);
          const topicTotal = calculateTopicTotal(topic);
          const hasTopicDiscount = topic.discountType && topic.discountValue;
          const isCapped = topic.pricingMode === "HOURLY" && topic.capHours && totalHours > topic.capHours;

          return (
            <View key={topic.id} style={topicIndex === 0 ? { ...styles.topicContainer, marginTop: 0 } : styles.topicContainer}>
              {/* Keep topic header + table header together to prevent orphaned headers */}
              <View wrap={false}>
                <View style={styles.topicHeader}>
                  <Text style={styles.topicName}>{topic.topicName}</Text>
                </View>
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
              </View>

              {/* Line items with zebra striping */}
              {topic.lineItems.filter((item) => item.waiveMode !== "EXCLUDED").map((item, index) => (
                <View
                  key={item.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  wrap={false}
                >
                  <Text style={styles.dateCol}>{formatDate(item.date)}</Text>
                  <Text style={styles.serviceCol}>
                    {item.description}{item.waiveMode === "ZERO" ? " (Waived)" : ""}
                  </Text>
                  <Text style={styles.timeCol}>
                    {item.waiveMode === "ZERO"
                      ? `${formatHours(item.hours || 0)} (Waived)`
                      : item.hours ? formatHours(item.hours) : "—"}
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
                    {!isRetainer && isCapped
                      ? `${formatHours(topic.capHours!)} (capped from ${formatHours(totalHours)})`
                      : formatHours(totalHours)}
                  </Text>
                </View>
                {isRetainer ? (
                  /* Retainer mode: no per-topic monetary amounts */
                  null
                ) : topic.pricingMode === "HOURLY" ? (
                  <>
                    <View style={styles.topicFooterRow}>
                      <Text style={styles.topicFooterLabel}>
                        Hourly Rate:
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
                            -{formatCurrency(baseTopicTotal - topicTotal)}
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
                        -{formatCurrency(baseTopicTotal - topicTotal)}
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
              <Text style={styles.firmDetail}>{firmDetails.address}</Text>
              <Text style={styles.firmDetail}>{firmDetails.city}</Text>
              <Text style={styles.firmDetail}>{firmDetails.email}</Text>
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
