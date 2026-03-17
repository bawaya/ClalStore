<?php
/**
 * Settings for Upay Gateway.
 *
 */

defined( 'ABSPATH' ) || exit;

return array(
	'enabled'               => array(
		'title'   => __( 'Enable/Disable', 'woocommerce-gateway-upay'),
		'type'    => 'checkbox',
		'label'   => __( 'Enable Upay', 'woocommerce-gateway-upay' ),
		'default' => 'no',
	),
	'title'                 => array(
		'title'       => __( 'Title', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'description' => __( 'This controls the title which the user sees during checkout.', 'woocommerce-gateway-upay' ),
		'default'     => __( 'Upay', 'woocommerce-gateway-upay' ),
		'desc_tip'    => true,
	),
	'description'           => array(
		'title'       => __( 'Description', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'desc_tip'    => true,
		'description' => __( 'This controls the description which the user sees during checkout.', 'woocommerce-gateway-upay' ),
		'default'     => __( "Pay securely by Credit or Debit Card through Upay.", 'woocommerce-gateway-upay' ),
	),
	'advanced'              => array(
		'title'       => __( 'Advanced options', 'woocommerce-gateway-upay' ),
		'type'        => 'title',
		'description' => '',
	),
        'numberpayments'        => array(
		'title'       => __( 'Number of payments', 'woocommerce-gateway-upay' ),
		'type'        => 'number',
		'description' => __( 'NUMBERPAYMENTS (commission when using payments).', 'woocommerce-gateway-upay' ),
		'default'     => __( 1, 'woocommerce-gateway-upay' ),
		'desc_tip'    => true,
	),
        'language'   => array(
                'title'       => __( 'Language', 'woocommerce-gateway-upay' ),
                'type'        => 'select',
                'default'     => 'HE',
                'options'     => array(
                        'EN' => __( 'English', 'woocommerce-gateway-upay' ),
                        'HE' => __( 'Hebrew', 'woocommerce-gateway-upay' )
                )
        ),
        'show_icon'   => array(
                'title'       => __( 'Show icon', 'woocommerce-gateway-upay' ),
                'type'        => 'select',
                'default'     => 'yes',
                'options'     => array(
                    'yes' => 'Yes',
                    'no'  => 'No'
                )
        ),
        'selected_icon'       => array(
		'title'       => __( 'Choose icon', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'desc_tip'    => true,
		'description' => __( 'Please upload new icon in media library. Copy url of new icon and paste in this field.', 'woocommerce-gateway-upay' ),
	),
        'height_desktop'      => array(
		'title'       => __( 'Iframe height (desktop)', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'desc_tip'    => true,
		'description' => __( 'Iframe height for desktop in pixels', 'woocommerce-gateway-upay' ),
		'default'     => __( "400", 'woocommerce-gateway-upay' ),
	),
	'height_mobile'      => array(
		'title'       => __( 'Iframe height (mobile)', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'desc_tip'    => true,
		'description' => __( 'Iframe height for mobile in pixels', 'woocommerce-gateway-upay' ),
		'default'     => __( "600", 'woocommerce-gateway-upay' ),
	),
        'support_woocommerce_blocks' => array(
                'title' => __( 'WooCommerce Blocks Checkout', 'woocommerce-gateway-upay' ), 
                'type' => 'checkbox',
                'label' => __( 'Enable WooCommerce Blocks Checkout (experimental)  support.', 'woocommerce-gateway-upay' ),
                'description' => __( 'Shows "Upay" as a supported payment gateway on the new WooCommerce Blocks Checkout.', 'woocommerce-gateway-upay' ),
                'default' => 'no'
        ),
	'testmode'              => array(
		'title'       => __( 'Upay sandbox', 'woocommerce-gateway-upay' ),
		'type'        => 'checkbox',
		'label'       => __( 'Enable Upay sandbox', 'woocommerce-gateway-upay' ),
		'default'     => 'no',
		'description' => __( 'Upay sandbox can be used to test payments.', 'woocommerce-gateway-upay' ),
	),
	'debug'                 => array(
		'title'       => __( 'Debug log', 'woocommerce-gateway-upay' ),
		'type'        => 'checkbox',
		'label'       => __( 'Enable logging', 'woocommerce-gateway-upay' ),
		'default'     => 'no',
		'description' => sprintf( __( 'Log Upay events, such as Return requests, inside %s Note: this may log personal information. We recommend using this for debugging purposes only and deleting the logs when finished.', 'woocommerce-gateway-upay' ), '<code>' . WC_Log_Handler_File::get_log_file_path( 'upay' ) . '</code>' ),
	),
        'button_text' => array(
		'title'       => __( 'Button Text', 'woocommerce-gateway-upay' ),
                'description' => __( 'Change checkout submit button text.', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'default'     => __( 'Proceed to Upay', 'woocommerce-gateway-upay' ),
                'desc_tip'    => true
	),
        'what_is_upay'           => array(
		'title'       => __( '"What is Upay?" Link', 'woocommerce-gateway-upay' ),
		'type'        => 'title'
	),
        'what_is_upay_link_text'                 => array(
		'title'       => __( 'Link text', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'default'     => __( 'What is Upay?', 'woocommerce-gateway-upay' ),
	),
        'what_is_upay_url'                 => array(
		'title'       => __( 'Url', 'woocommerce-gateway-upay' ),
		'type'        => 'url',
		'default'     => __( 'https://www.upay.co.il/', 'woocommerce-gateway-upay' ),
	),
	'api_details'           => array(
		'title'       => __( 'API credentials', 'woocommerce-gateway-upay' ),
		'type'        => 'title'
	),
	'api_username'          => array(
		'title'       => __( 'API username', 'woocommerce-gateway-upay' ),
		'type'        => 'text',
		'description' => __( 'Get your API credentials from Upay.', 'woocommerce-gateway-upay' ),
		'default'     => '',
		'desc_tip'    => true,
		'placeholder' => __( 'Optional', 'woocommerce-gateway-upay' ),
	),
	'api_key'          => array(
		'title'       => __( 'API key', 'woocommerce-gateway-upay' ),
		'type'        => 'password',
		'description' => __( 'Get your API credentials from Upay.', 'woocommerce-gateway-upay' ),
		'default'     => '',
		'desc_tip'    => true,
		'placeholder' => __( 'Optional', 'woocommerce-gateway-upay' ),
	)
);
