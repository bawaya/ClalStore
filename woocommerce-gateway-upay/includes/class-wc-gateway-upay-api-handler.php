<?php 
/**
 * Class WC_Gateway_Upay_API_Handler file.
 *
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handles API requests
 *
 */
class WC_Gateway_Upay_API_Handler{
    
    /**
    * API Username
    *
    * @var string
    */
    protected $_api_username;

   /**
    * API Password
    *
    * @var string
    */
    protected $_api_key;

   /**
    * Sandbox
    *
    * @var bool
    */
    protected $_sandbox = false;
    
    /**
    * Numberpayments
    *
    * @var int
    */
    protected $_numberpayments = 1;
    
    /**
    * Language
    *
    * @var string
    */
    protected $_language = 'HE';
    
    /**
     * Session
     *
     * @var string
     */
    protected $_session = null;    
    
    /**
    * Constructor.
    *
    * @param string api_username
    * @param string api_key
    * @param bool sandbox
    */
   public function __construct($api_username, $api_key, $sandbox, $numberpayments, $language) {
       $this->_api_username = $api_username;
       $this->_api_key = $api_key;
       $this->_sandbox = $sandbox;
       $this->_numberpayments = $numberpayments;
       $this->_language = $language;
   }
        
    /**
     * Verify Transaction
     * @param int transaction ID
     * @param int order Id
     */
    public function verifyTransaction($id, $orderId)
    {
        $trx = self::getTransaction($id);
        WC_Gateway_Upay::log( 'Transaction: ' . wc_print_r( $trx, true ) );
        if(!$trx){
            return false;
        }
        
        if($trx["transferstatus"] != "S" && $trx["transferstatus"] != "A"){
            return false;
        }
        if($orderId != $trx["productdescription"]){
            return false;
        }
        return true;
    }
    
    /**
     * Get Transaction
     * @param string trx id
     * @return mixed
     * 
     */
    public function getTransaction($id)
    {        
        $res = self::doRequest("https://app.upay.co.il/API6/clientsecure/json.php", array(
            "msgs" => json_encode(array(
                array(
                    "header" => array(
                        "refername" => "UPAY",
                        "livesystem" => ($this->_sandbox ? 0 : 1),
                        "language" => $this->_language
                    ),
                    "request" => array(
                        "mainaction" => "CONNECTION",
                        "minoraction" => "LOGIN",
                        "encoding" => "json",
                        "parameters" => array(
                            "email" => $this->_api_username,
                            "key" => $this->_api_key
                        )
                    )                
                ),
                array(
                    "header" => array(
                        "refername" => "UPAY",
                        "livesystem" => ($this->_sandbox ? 0 : 1),
                        "language" => $this->_language
                    ),
                    "request" => array(
                        "mainaction" => "TRANSACTIONSINFO", 
                        "minoraction" => "GETTRANSACTIONS", 
                        "encoding" => "json",
                        "parameters" => array(
                            "cashierids" => array(
                                $id
                            )
                        )
                    )                
                )
            )
        )));
        if(!$res || !isset($res["results"][1]["result"]["sendertransactions"][0])){
            return false;
        }
        return $res["results"][1]["result"]["sendertransactions"][0];
    }

    /**
     * Login
     * @return mixed
     */
    public function login()
    {
        $_session = self::getSession();
        if(!$_session){
            return false;
        }
        
        $res = self::makeRequest("https://app.upay.co.il/API6/clientsecure/json.php", array(
            "header" => array(
                "sessionid" => $_session
            ),
            "request" => array(
                "mainaction" => "CONNECTION", 
                "minoraction" => "LOGIN", 
                "encoding" => "json",
                "parameters" => array(
                    "email" => $this->_api_username,
                    "key" => $this->_api_key
                )
            )
        ));                        
        
        WC_Gateway_Upay::log( 'Login Response: ' . wc_print_r( $res, true ) );
        
        if($res && isset($res["success"]) && $res["success"]){
            return true;
        }
        return false;
    }
    
    /**
     * Get Session   
     * @return mixed  
     */
    public function getSession()
    {
        if(!$this->_session){
            $res = self::makeRequest("https://app.upay.co.il/API6/client/json.php", array(
                "header" => array(
                    "refername" => "UPAY",
                    "livesystem" => ($this->_sandbox ? 0 : 1),
                    "language" => $this->_language
                ),
                "request" => array(
                    "mainaction" => "SESSION", 
                    "minoraction" => "GETSESSION", 
                    "encoding" => "json"
                )
            ));                        
            
            WC_Gateway_Upay::log( 'Get Session Response: ' . wc_print_r( $res, true ) );
            
            if(!$res || !isset($res["success"]) || !$res["success"] || !isset($res["result"]) || !isset($res["result"]["sessionid"])){
                return false;
            }
            $this->_session = $res["result"]["sessionid"];
        }
        return $this->_session;
    }
    
    /**
     * Make request
     * @param string url
     * @param array data
     * @return mixed
     */
    public function makeRequest($url, $data)
    {
        return $this->doRequest($url, array(
            "msg" => json_encode($data)
        ));        
    }
    
    
    /**
     * Do request
     * @param string url
     * @param array data
     * @return mixed
     */
    public function doRequest($url, $data)
    {
        $curl = curl_init($url);
        curl_setopt($curl,CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($curl,CURLOPT_HEADER, 0 ); 
        curl_setopt($curl,CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($curl,CURLOPT_POST,1);         
        $query = http_build_query($data);          
        curl_setopt($curl, CURLOPT_POSTFIELDS, $query);
        curl_setopt($curl, CURLOPT_HTTPHEADER, array('Content-Type: application/x-www-form-urlencoded')); 
        $res = curl_exec($curl);
        curl_close ($curl);        
        return json_decode($res, true);
    }
    
    
    
    
    /**
     * Get 
     */
    public function getRedirectUrl($order)
    {
        global $woocommerce;
        
        $transfer = array(
            "email" => $this->_api_username,                                    
            "commissionreduction" => 0,
            "amount" => $order->get_total(),
            "currency" => $order->get_currency(),
            "maxpayments" => $this->_numberpayments,
            "paymentdate" => date("Y-m-d"),
            "productdescription" => $order->get_id(),
            "returnurl" => add_query_arg(
                array(
                    'order_id'=> $order->get_id(), 
                    'order_key'=>$order->get_order_key()
                ), 
                $woocommerce->api_request_url('WC_Gateway_Upay')),
            "ipnurl" => add_query_arg(
                array(
                    'order_id'=> $order->get_id(), 
                    'order_key'=>$order->get_order_key()
                ), 
                $woocommerce->api_request_url('WC_Gateway_Upay'))                                    
        );
        
        if (strpos($order->billing_phone, '05') === 0 || strpos($order->billing_phone, '+9725') === 0){
            $transfer["cellphonenotify"] = str_replace('-', '', $order->billing_phone);
        }
        if ($order->billing_email){
        	$transfer["emailnotify"] = $order->billing_email;
        }
        $res = self::doRequest("https://app.upay.co.il/API6/clientsecure/json.php", array(
            "msgs" => json_encode(array(
                array(
                    "header" => array(
                        "refername" => "UPAY",
                        "livesystem" => ($this->_sandbox ? 0 : 1),
                        "language" => $this->_language
                    ),
                    "request" => array(
                        "mainaction" => "CONNECTION",
                        "minoraction" => "LOGIN",
                        "encoding" => "json",
                        "parameters" => array(
                            "email" => $this->_api_username,
                            "key" => $this->_api_key
                        )
                    )                
                ),
                array(
                    "header" => array(
                        "refername" => "UPAY",
                        "livesystem" => ($this->_sandbox ? 0 : 1),
                        "language" => $this->_language
                    ),
                    "request" => array(
                        "mainaction" => "CASHIER",
                        "minoraction" => "REDIRECTDEPOSITCREDITCARDTRANSFER",
                        "encoding" => "json",
                        "numbertemplate" => 15,
                        "parameters" => array(
                            "transfers" => array($transfer),
                            "foreign" => "0",
                            "key" => $this->_api_key,
                            "cardreader" => "0",
                            "creditcardcompanytype" => "ISR",
                            "creditcardtype" => "PR"
                        )
                    )                
                )
            )
        )));
        if(!$res){
            return false;
        }        
        return isset($res["results"][1]["result"]["transactions"][0]["url"]) ? $res["results"][1]["result"]["transactions"][0]["url"] : false;
    }
}

