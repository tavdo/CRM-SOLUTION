import Link from "next/link";
import { LegalLinks } from "./LegalLinks";
import { BrandLogo } from "./BrandLogo";

export type InformationKind = "privacy" | "terms" | "contact";
export const informationTitles = {
  ka: { privacy: "კონფიდენციალურობის ინფორმაცია", terms: "გამოყენების პირობები", contact: "დაგვიკავშირდი" },
  en: { privacy: "Privacy information", terms: "Terms of use", contact: "Contact us" },
};

export function PublicInformation({ locale, kind }: { locale: "ka" | "en"; kind: InformationKind }) {
  const ka = locale === "ka";
  const operator = process.env.OPERATOR_NAME?.trim();
  const email = process.env.SUPPORT_EMAIL?.trim();
  const content = ka ? {
    privacy: [
      ["რას ვამუშავებთ", "ანგარიშის სახელს, ელფოსტას, ჰეშის სახით შენახულ პაროლს, სამუშაო სივრცის წევრობასა და როლებს. სამუშაო სივრცეში ინახება თქვენს მიერ დამატებული კლიენტები, კონტაქტები, მოთხოვნები, გარიგებები, ამოცანები, ინვოისები, პროექტები და ატვირთული ფაილები."],
      ["რისთვის ვიყენებთ მონაცემებს", "ანგარიშში შესვლისთვის, თქვენი გუნდის სამუშაოს შესასრულებლად, მონაცემებზე წვდომის გასაკონტროლებლად, მოწვევებისა და უსაფრთხოების წერილების გასაგზავნად და მნიშვნელოვანი ცვლილებების აუდიტისთვის. სამუშაო სივრცის ადმინისტრატორი განსაზღვრავს წევრების წვდომას."],
      ["დაკავშირებული არხები და მომწოდებლები", "სოციალური არხის ჩართვისას ვამუშავებთ შესაბამის შეტყობინებებს, კონტაქტის იდენტიფიკატორებსა და დანართებს. მონაცემების შენახვისა და წერილების მიწოდებისთვის გამოიყენება პლატფორმის არჩეული ინფრასტრუქტურის მომწოდებლები. მხოლოდ ანგარიშის შექმნა სოციალურ არხებს არ აკავშირებს."],
      ["ფაილები და უსაფრთხოება", "პირადი ფაილები გაიცემა უფლებების შემოწმების შემდეგ. გარე საკომუნიკაციო სერვისისთვის გასაგზავნ დანართს შეიძლება ჰქონდეს დროებითი ხელმოწერილი ბმული. სესიის ქუქი საჭიროა ავტორიზაციისთვის; ენისა და თემის პარამეტრები ინახება მოწყობილობაზე."],
      ["შენახვა, ექსპორტი და წაშლა", "CRM ჩანაწერები ავტომატურად არ იშლება. ადმინისტრატორს შეუძლია სამუშაო სივრცის ექსპორტი. მონაცემების გასწორების, წვდომის ან წაშლის მოთხოვნა გამოგზავნეთ საკონტაქტო მისამართზე; შესაბამისობასა და შენახვის საჭიროებას ოპერატორი განიხილავს. სარეზერვო ასლების შენახვა და წაშლა ცალკე საოპერაციო პროცესია."],
    ],
    terms: [
      ["პლატფორმის დანიშნულება", "CRM Solution ეხმარება გუნდს კლიენტების, გაყიდვებისა და პროექტების აღრიცხვაში. ხელმისაწვდომი ფუნქციები განისაზღვრება სამუშაო სივრცის კონფიგურაციითა და წინასწარ შეთანხმებული შეთავაზებით."],
      ["ანგარიში და გუნდის წვდომა", "გამოიყენეთ მოქმედი ელფოსტა და დაიცავით პაროლი. ადმინისტრატორი პასუხისმგებელია მოწვეული წევრებისა და მინიჭებული როლების მართვაზე. არ სცადოთ სხვის მონაცემებზე ან სამუშაო სივრცეზე უნებართვო წვდომა."],
      ["თქვენი მონაცემები", "პლატფორმაში შეიტანეთ მხოლოდ ის ინფორმაცია, რომლის დამუშავების უფლებაც გაქვთ. მომხმარებელი პასუხისმგებელია შეტანილი მონაცემების სისწორესა და კლიენტებთან კომუნიკაციის საფუძველზე. ექსპორტისა და მონაცემებთან დაკავშირებული მოთხოვნებისთვის იხილეთ კონფიდენციალურობის გვერდი."],
      ["ფინანსური ჩანაწერები და ინტეგრაციები", "ინვოისი, გადახდის ჩანაწერი ან კლიენტის თანხმობის აღრიცხვა თავისთავად არ ადასტურებს საბანკო გადარიცხვას, RS.ge-ში რეგისტრაციას ან ელექტრონულ ხელმოწერას. გარე არხის მუშაობას შესაბამისი მომწოდებლის ანგარიში და ნებართვები სჭირდება."],
      ["საფასური და მომსახურების ცვლილებები", "საფასური და მომსახურების მოცულობა ცალკე უნდა იყოს შეთანხმებული. რეგისტრაციის ფორმა არ ითხოვს საბანკო ბარათს და ავტომატურ გადახდას არ რთავს. კითხვებისა და მომსახურების შეწყვეტის მოთხოვნისთვის დაუკავშირდით ოპერატორს."],
    ],
    contact: [["დახმარება", "მოგვწერეთ ანგარიშში შესვლის, გუნდის მართვის, ხარვეზის ან მონაცემებთან დაკავშირებული მოთხოვნის შესახებ. მიუთითეთ სამუშაო სივრცის სახელი და პრობლემის მოკლე აღწერა. არ გამოგზავნოთ პაროლები, საიდუმლო გასაღებები ან კლიენტების სრული მონაცემთა ბაზა."]],
  } : {
    privacy: [
      ["Information we process", "We process account names, email addresses, hashed passwords, workspace memberships and roles. Workspaces hold the customers, contacts, leads, deals, tasks, invoices, projects and files your team adds."],
      ["How information is used", "Information supports sign-in, team workflows, access control, invitations, security email and audit records. Workspace administrators control member access."],
      ["Connected channels and providers", "When a social channel is connected, we process its messages, contact identifiers and attachments. The platform's selected infrastructure providers handle data storage and email delivery. Creating a CRM account does not connect social accounts automatically."],
      ["Files and security", "Private files require access checks. Attachments sent through an external messaging provider may use a temporary signed link. A session cookie supports sign-in; language and theme preferences are stored on your device."],
      ["Retention, export and deletion", "CRM records are not automatically deleted. Administrators can export workspace data. Contact the operator to request access, correction or deletion; requests are reviewed against access and retention needs. Backup retention and deletion are managed separately."],
    ],
    terms: [
      ["Purpose", "CRM Solution helps teams record customers, sales and projects. Available features depend on workspace configuration and the agreed service offering."],
      ["Accounts and team access", "Use a valid email and protect your password. Administrators manage invited members and their roles. Do not attempt unauthorized access to another user's data or workspace."],
      ["Your information", "Only enter information you are authorized to process. You are responsible for its accuracy and the basis for customer communications. See the privacy page for export and data requests."],
      ["Financial records and integrations", "An invoice, payment entry or recorded customer confirmation does not independently verify a bank transfer, tax-system submission or electronic signature. External channels require the relevant provider account and permissions."],
      ["Fees and service changes", "Fees and service scope must be agreed separately. The registration form does not request a payment card or activate automatic charges. Contact the operator with questions or to request service termination."],
    ],
    contact: [["Support", "Contact us about sign-in, team management, an issue or a data request. Include your workspace name and a short description. Do not send passwords, secret keys or a full customer database."]],
  };
  return <div className="crm-workspace" style={{ minHeight: "100vh", padding: "clamp(1rem, 4vw, 3rem)" }}>
    <header style={{ maxWidth: "900px", margin: "0 auto 2rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between" }}>
      <Link href={`/${locale}`}><BrandLogo name="CRM Solution" /></Link><LegalLinks locale={locale} />
    </header>
    <main className="surface" style={{ maxWidth: "900px", margin: "auto", padding: "clamp(1.25rem, 4vw, 3rem)", overflowWrap: "anywhere" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.3rem)", marginBottom: "1.5rem" }}>{informationTitles[locale][kind]}</h1>
      {content[kind].map(([title, body]) => <section key={title} style={{ marginTop: "1.5rem" }}><h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{title}</h2><p style={{ lineHeight: 1.8 }}>{body}</p></section>)}
      <section style={{ marginTop: "2rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
        {operator && <p>{ka ? "ოპერატორი: " : "Operator: "}{operator}</p>}
        {email ? <p><a href={`mailto:${email}`}>{email}</a></p> : <p>{ka ? "საკონტაქტო ინფორმაცია გამოქვეყნდება პლატფორმის გაშვებამდე." : "Contact information will be published before launch."}</p>}
        <p className="muted" style={{ marginTop: "0.75rem" }}>{ka ? "განახლებულია: 6 ნოემბერი, 2026" : "Updated: 6 November 2026"}</p>
      </section>
    </main>
  </div>;
}
