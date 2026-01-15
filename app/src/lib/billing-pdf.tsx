import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { ServiceDescription } from "@/types";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  clientInfo: {
    fontSize: 10,
  },
  logo: {
    fontSize: 16,
    color: "#FF9999",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textDecoration: "underline",
    marginTop: 15,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#000",
  },
  topicHeader: {
    backgroundColor: "#f5d5de",
    padding: 5,
    marginTop: 15,
    marginBottom: 5,
  },
  topicName: {
    fontWeight: "bold",
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5d5de",
    padding: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
  },
  dateCol: {
    width: "15%",
  },
  serviceCol: {
    width: "70%",
  },
  timeCol: {
    width: "15%",
    textAlign: "right",
  },
  topicFooter: {
    marginTop: 5,
    alignItems: "flex-end",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  footerLabel: {
    width: 120,
    textAlign: "right",
    marginRight: 10,
  },
  footerValue: {
    width: 80,
    textAlign: "right",
  },
});

// EUR to BGN fixed rate
const EUR_TO_BGN = 1.95583;

function formatCurrency(amount: number, currency: "EUR" | "BGN" = "EUR"): string {
  const symbol = currency === "EUR" ? "\u20AC" : "BGN";
  return `${symbol} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatPeriod(startStr: string): string {
  const start = new Date(startStr);
  return start.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }).replace(" ", "-");
}

function calculateTopicTotal(topic: ServiceDescription["topics"][0]): number {
  if (topic.pricingMode === "FIXED") return topic.fixedFee || 0;
  const totalHours = topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
  const hourlyTotal = totalHours * (topic.hourlyRate || 0);
  const fixedTotal = topic.lineItems.reduce((sum, item) => sum + (item.fixedAmount || 0), 0);
  return hourlyTotal + fixedTotal;
}

function calculateTopicHours(topic: ServiceDescription["topics"][0]): number {
  return topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
}

interface ServiceDescriptionPDFProps {
  data: ServiceDescription;
}

export function ServiceDescriptionPDF({ data }: ServiceDescriptionPDFProps) {
  const grandTotal = data.topics.reduce((sum, topic) => sum + calculateTopicTotal(topic), 0);
  const grandTotalBGN = grandTotal * EUR_TO_BGN;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>DESCRIPTION OF LEGAL SERVICES</Text>

        {/* Header with client info and logo */}
        <View style={styles.header}>
          <View style={styles.clientInfo}>
            <Text>{data.client.invoicedName || data.client.name}</Text>
            {data.client.invoiceAttn && <Text>Attn: {data.client.invoiceAttn}</Text>}
            <Text>Period: {formatPeriod(data.periodStart)}</Text>
          </View>
          <View>
            <Text style={styles.logo}>VEDA</Text>
            <Text style={{ color: "#FF9999", fontSize: 8 }}>LEGAL</Text>
          </View>
        </View>

        {/* Summary section */}
        <Text style={styles.sectionTitle}>Services rendered as per list of services</Text>
        {data.topics.map((topic) => (
          <View key={topic.id} style={styles.summaryRow}>
            <Text>{topic.topicName}</Text>
            <Text>{formatCurrency(calculateTopicTotal(topic))}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={{ fontWeight: "bold", marginRight: 20 }}>Total Fees:</Text>
          <Text style={{ fontWeight: "bold" }}>{formatCurrency(grandTotal)} excl. VAT</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 2 }}>
          <Text>{formatCurrency(grandTotalBGN, "BGN")} excl. VAT</Text>
        </View>

        {/* Description of services */}
        <Text style={styles.sectionTitle}>Description of services</Text>

        {/* Topic sections */}
        {data.topics.map((topic) => {
          const totalHours = calculateTopicHours(topic);
          const topicTotal = calculateTopicTotal(topic);

          return (
            <View key={topic.id}>
              {/* Topic name header */}
              <View style={styles.topicHeader}>
                <Text style={styles.topicName}>{topic.topicName}</Text>
              </View>

              {/* Table header */}
              <View style={styles.tableHeader}>
                <Text style={styles.dateCol}>Date</Text>
                <Text style={styles.serviceCol}>Service</Text>
                <Text style={styles.timeCol}>Time</Text>
              </View>

              {/* Line items */}
              {topic.lineItems.map((item) => (
                <View key={item.id} style={styles.tableRow} wrap={false}>
                  <Text style={styles.dateCol}>{formatDate(item.date)}</Text>
                  <Text style={styles.serviceCol}>{item.description}</Text>
                  <Text style={styles.timeCol}>
                    {item.hours ? formatTime(item.hours) : ""}
                  </Text>
                </View>
              ))}

              {/* Topic footer */}
              <View style={styles.topicFooter} wrap={false}>
                <View style={styles.footerRow}>
                  <Text style={styles.footerLabel}>Total time:</Text>
                  <Text style={styles.footerValue}>{formatTime(totalHours)}</Text>
                </View>
                {topic.pricingMode === "HOURLY" ? (
                  <>
                    <View style={styles.footerRow}>
                      <Text style={styles.footerLabel}>Fees rate (VAT excl.)/hrs</Text>
                      <Text style={styles.footerValue}>{formatCurrency(topic.hourlyRate || 0)}</Text>
                    </View>
                    <View style={styles.footerRow}>
                      <Text style={styles.footerLabel}>Fee:</Text>
                      <Text style={styles.footerValue}>{formatCurrency(topicTotal)}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.footerRow}>
                    <Text style={styles.footerLabel}>Fee (fixed)</Text>
                    <Text style={styles.footerValue}>{formatCurrency(topicTotal)}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
