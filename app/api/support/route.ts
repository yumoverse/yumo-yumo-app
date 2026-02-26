import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Prepare email content
    const emailContent = `
New Support Request from Yumo Yumo Website

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This email was sent from the Yumo Yumo support form.
    `.trim();

    // In production, you would use an email service like:
    // - Resend (recommended for Next.js)
    // - SendGrid
    // - Nodemailer with SMTP
    // - AWS SES
    
    // For now, we'll log it and return success
    // You need to implement actual email sending
    console.log("Support form submission:", {
      to: "support@yumoyumo.com",
      subject: `Support Request: ${subject}`,
      body: emailContent,
    });

    // TODO: Implement actual email sending
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'noreply@yumoyumo.com',
    //   to: 'support@yumoyumo.com',
    //   subject: `Support Request: ${subject}`,
    //   text: emailContent,
    //   replyTo: email,
    // });

    // For development, you can use a service like Mailtrap or just log it
    // In production, configure your email service and uncomment the code above

    return NextResponse.json({
      success: true,
      message: "Support request submitted successfully",
    });
  } catch (error: any) {
    console.error("Support form error:", error);
    return NextResponse.json(
      {
        error: "Failed to submit support request",
        details: error.message,
      },
      { status: 500 }
    );
  }
}







