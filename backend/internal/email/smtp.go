package email

import (
	"bytes"
	"crypto/tls"
	"embed"
	"fmt"
	"html/template"
	"net/smtp"
	"time"
)

//go:embed templates/invitation.html
var templateFS embed.FS

type SMTPService struct {
	host               string
	port               string
	username           string
	password           string
	from               string
	invitationTemplate *template.Template
}

type InvitationTemplateData struct {
	Name      string
	InviteURL string
	ProjectName string
	ExpiresAt string
}

func NewSMTPService(
	host string,
	port string,
	username string,
	password string,
	from string,
) (*SMTPService, error) {
	invitationTemplate, err := template.ParseFS(
		templateFS,
		"templates/invitation.html",
	)
	if err != nil {
		return nil, fmt.Errorf("parse invitation template: %w", err)
	}

	return &SMTPService{
		host:               host,
		port:               port,
		username:           username,
		password:           password,
		from:               from,
		invitationTemplate: invitationTemplate,
	}, nil
}

func (s *SMTPService) SendInvitation(
	recipient string,
	name string,
	projectName string,
	inviteURL string,
	expiresAt time.Time,
) error {
	data := InvitationTemplateData{
		Name:      name,
		InviteURL: inviteURL,
		ProjectName: projectName,
		ExpiresAt: expiresAt.Format(time.RFC1123),
	}

	var body bytes.Buffer

	if err := s.invitationTemplate.Execute(&body, data); err != nil {
		return fmt.Errorf("render invitation template: %w", err)
	}

	address := fmt.Sprintf("%s:%s", s.host, s.port)

	client, err := smtp.Dial(address)
	if err != nil {
		return fmt.Errorf("connect to SMTP server: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{
		ServerName: s.host,
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("start TLS: %w", err)
		}
	} else {
		return fmt.Errorf("SMTP server does not support STARTTLS")
	}

	auth := smtp.PlainAuth(
		"",
		s.username,
		s.password,
		s.host,
	)

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP authentication: %w", err)
	}

	if err := client.Mail(s.from); err != nil {
		return fmt.Errorf("set sender: %w", err)
	}

	if err := client.Rcpt(recipient); err != nil {
		return fmt.Errorf("set recipient: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("open SMTP data connection: %w", err)
	}

	message := fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: You're invited to EnderTex\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=UTF-8\r\n"+
			"\r\n"+
			"%s",
		s.from,
		recipient,
		body.String(),
	)

	if _, err := writer.Write([]byte(message)); err != nil {
		_ = writer.Close()
		return fmt.Errorf("write email: %w", err)
	}

	if err := writer.Close(); err != nil {
		return fmt.Errorf("send email data: %w", err)
	}

	if err := client.Quit(); err != nil {
		return fmt.Errorf("close SMTP connection: %w", err)
	}

	return nil
}
